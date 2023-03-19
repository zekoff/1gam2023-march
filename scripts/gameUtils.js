// gameUtils.js

/**
 * Reduce all nodes in sector to the sum of the passed instance variable.
 * The instance variable must be a numeric value. This method is not exported
 * for use by Construct events.
 * @param {*} runtime Construct runtime
 * @param {*} varName the name of the instance variable to reduce, as a string
 * @returns the sum of the instance variable across all nodes
 */
function getNodeInstVarSum(runtime, varName) {
  const nodeArray = Array.from(runtime.objects.Nodes.instances());
  return nodeArray.reduce((sum, node) => sum + node.instVars[varName], 0);
}

/**
 * Get the current Quantia income/rate across the sector.
 */
export function getQuantiaRate(runtime) {
  return getNodeInstVarSum(runtime, "quantiaRate");
}

/**
 * Get the current Stellium income/rate across the sector.
 */
export function getStelliumRate(runtime) {
  return getNodeInstVarSum(runtime, "stelliumRate");
}

/**
 * Get the current rate of Quantia drain across the sector.
 */
export function getQuantiaDrain(runtime) {
  return getNodeInstVarSum(runtime, "quantiaDrain");
}

/**
 * Get the current rate of Stellium drain across the sector.
 */
export function getStelliumDrain(runtime) {
  return getNodeInstVarSum(runtime, "stelliumDrain");
}

/**
 * Check if a facility is prevented from being built on a planet.
 * 
 * Returns a user-readable error message if the facility cannot be built, or
 * false if the facility build is not prevented (i.e. the facility can be built).
 */
export function isFacilityBuildPrevented(runtime, planetUid, facilityName) {
  const planet = runtime.getInstanceByUid(planetUid);
  if (planet.instVars.explorationLevel === 0)
    return "Planet has not yet been scanned and charted.";
  if (!isPlanetSupplied(runtime, planet.uid) && facilityName !== "Warp Depot")
    return "Planet is not in supply network.";
  const numFacilitiesOnPlanet = JSON.parse(planet.instVars.facilityList).length;
  if (planet.instVars.totalFacilitySlots <= numFacilitiesOnPlanet)
    return "No available slots on this planet to build a new facility."
  const facilityData = JSON.parse(runtime.globalVars.facilityDataMapping)[facilityName];
  if (facilityData["Quantia Drain"] > getQuantiaRate(runtime) - getQuantiaDrain(runtime))
    return "Insufficient quantia generation to power this facility.";
  const stellium = runtime.objects.GameController.getFirstInstance().instVars.stelliumStockpile;
  if (facilityData["Stellium Cost"] > stellium)
    return "Insufficient stellium in stockpile to build this facility.";
  const crysether = runtime.objects.GameController.getFirstInstance().instVars.crysetherStockpile;
  if (facilityData["Crysether Cost"] > crysether)
    return "Insufficient crysether available to build this facility.";
  return false;
}

/**
 * Construct a facility on the designated planet. Does not verify that constraints
 * are met to construct the facility (enough resources, slots on target planet, etc.).
 * @param {*} runtime 
 * @param {*} planetUid 
 * @param {*} facilityName 
 */
export function buildFacilityOnPlanet(runtime, planetUid, facilityName) {
  const planet = runtime.getInstanceByUid(planetUid);
  const gameController = runtime.objects.GameController.getFirstInstance();
  const facilityData = JSON.parse(runtime.globalVars.facilityDataMapping)[facilityName];
  const facility = runtime.objects.Facility.createInstance("Facilities", planet.x, planet.y, "", "");
  facility.instVars.name = facilityName;
  facility.setAnimation(facilityData.Animation);
  facility.behaviors.Rotate.speed = planet.behaviors.Rotate.speed;
  const numFacilitiesOnPlanet = JSON.parse(planet.instVars.facilityList).length;
  facility.angleDegrees = 360 / planet.instVars.totalFacilitySlots * (numFacilitiesOnPlanet + 1);
  facility.angleDegrees += planet.angleDegrees;
  planet.instVars.quantiaRate += facilityData["Quantia Rate"];
  planet.instVars.stelliumRate += facilityData["Stellium Rate"];
  gameController.instVars.crysetherStockpile += facilityData["Crysether Gain"];
  const unpackedFacilityList = JSON.parse(planet.instVars.facilityList);
  unpackedFacilityList.push(facility.uid);
  planet.instVars.facilityList = JSON.stringify(unpackedFacilityList);
  if (facilityName === "Warp Depot") updatePlanetConnections(runtime);

  // Consume resources
  gameController.instVars.stelliumStockpile -= facilityData["Stellium Cost"];
  gameController.instVars.crysetherStockpile -= facilityData["Crysether Cost"];
  planet.instVars.stelliumDrain += facilityData["Stellium Drain"];
  planet.instVars.quantiaDrain += facilityData["Quantia Drain"];
}

/**
 * Connect all nearby eligible planets. Performs checks to verify that nearby
 * planets are eligble for connections (charted, within connection distance).
 * @param {*} runtime Construct runtime
 * @param {*} planetUid UID of planet to use as basis for connections
 * @param {*} connectionDistance distance to limit connections (if null, uses Construct
 * global WARP_DEPOT_RADIUS as default)
 */
export function connectNearbyPlanets(runtime, planetUid, connectionDistance = null) {
  if (connectionDistance === null) connectionDistance = runtime.globalVars.WARP_DEPOT_RADIUS;
  const planet = runtime.getInstanceByUid(planetUid);
  const planetsInRange = [];
  for (let testPlanet of runtime.objects.Planet.instances()) {
    if (testPlanet.uid === planet.uid) continue;
    if (testPlanet.instVars.explorationLevel === 0) continue;
    const distanceAway = Math.hypot(testPlanet.x - planet.x, testPlanet.y - planet.y);
    if (connectionDistance >= distanceAway) planetsInRange.push(testPlanet);
  }
  for (const destinationPlanet of planetsInRange) {
    connectNodes(runtime, planet.uid, destinationPlanet.uid);
  }
}

/**
 * Connect two nodes by adding them each to the others Node.connectionList instVar.
 * This method adds the provided nodes without performing any checks to verify
 * that they are eligible to be connected (distance, warp depot, etc.). If either
 * node is already in the connectionList of the other, that unidirectional
 * connection will not be added (so, this method is idempotent if both nodes are
 * already connected).
 * 
 * @param {*} runtime the Construct runtime
 * @param {*} node1Uid object UID of the first node
 * @param {*} node2Uid object UID of the second node
 */
export function connectNodes(runtime, node1Uid, node2Uid) {
  const node1 = runtime.getInstanceByUid(node1Uid);
  const node2 = runtime.getInstanceByUid(node2Uid);
  const node1Connections = JSON.parse(node1.instVars.connectionList);
  const node2Connections = JSON.parse(node2.instVars.connectionList);
  if (!node1Connections.includes(node2Uid)) node1Connections.push(node2Uid);
  if (!node2Connections.includes(node1Uid)) node2Connections.push(node1Uid);
  node1.instVars.connectionList = JSON.stringify(node1Connections);
  node2.instVars.connectionList = JSON.stringify(node2Connections);
}

/**
 * Scan entire sector and update connections for all planets. Planets are connected
 * if they are in range of a Warp Depot, and any Warp Depot is also connected to
 * every other Warp Depot.
 * @param {*} runtime Construct runtime
 * @param {*} connectionDistance distance to limit connections (if null, uses Construct
 * global WARP_DEPOT_RADIUS as default)
 */
export function updatePlanetConnections(runtime, connectionDistance = null) {
  if (connectionDistance === null) connectionDistance = runtime.globalVars.WARP_DEPOT_RADIUS;
  const warpDepotPlanets = getPlanetsWithWarpDepots(runtime);
  for (const planet of runtime.objects.Planet.instances()) {
    if (isFacilityOnPlanet(runtime, planet.uid, "Warp Depot") ||
      isFacilityOnPlanet(runtime, planet.uid, "Colony")) {
      connectNearbyPlanets(runtime, planet.uid, connectionDistance);
      for (const otherWarpDepotPlanet of warpDepotPlanets) {
        if (planet.uid !== otherWarpDepotPlanet.uid)
          connectNodes(runtime, planet.uid, otherWarpDepotPlanet.uid);
      }
    }
  }
};

/**
 * Check if a planet has the named facility present.
 * @param {*} runtime Construct runtime
 * @param {*} planetUid UID of planet to check
 * @param {*} facilityName the name of the facility to check for
 * @returns true if planet has at least one of the named facility, false otherwise
 */
export function isFacilityOnPlanet(runtime, planetUid, facilityName) {
  const planet = runtime.getInstanceByUid(planetUid);
  const facilityUids = JSON.parse(planet.instVars.facilityList);
  const facilities = facilityUids.map(uid => runtime.getInstanceByUid(uid));
  return facilities.filter(facility => facility.instVars.name === facilityName).length > 0;
}

/**
 * Get a list of all planets with Warp Depots or the Colony on them. The returned array
 * contains planet instances (not just UIDs).
 * @param {*} runtime the Construct runtime
 * @returns an array of Planet instances that have Warp Depots on them (or an empty
 * array if no planet has a Warp Depot)
 */
export function getPlanetsWithWarpDepots(runtime) {
  const planetsWithWarpDepots = [];
  for (const planet of runtime.objects.Planet.instances()) {
    if (isFacilityOnPlanet(runtime, planet.uid, "Warp Depot") ||
      isFacilityOnPlanet(runtime, planet.uid, "Colony")) planetsWithWarpDepots.push(planet);
  }
  return planetsWithWarpDepots;
}

/**
 * Determine whether a planet is in the supply network.
 * @param {*} runtime Construct runtime
 * @param {*} planetUid planet to check for supply
 * @returns true if the planet is in the supply network, else false
 */
export function isPlanetSupplied(runtime, planetUid) {
  return getConnectedPlanets(runtime, planetUid).length > 0 ||
    isFacilityOnPlanet(runtime, planetUid, "Colony");
}

/**
 * Get a list of all planets connected to the given planet. The returned array
 * contains Planet instances (not just UIDs).
 * @param {*} runtime the Construct runtime
 * @param {*} planetUid the planet to check for connections
 * @returns an array of everything in the planet's connectionList
 */
export function getConnectedPlanets(runtime, planetUid) {
  const planet = runtime.getInstanceByUid(planetUid);
  const connectedPlanetUids = JSON.parse(planet.instVars.connectionList);
  return connectedPlanetUids.map(uid => runtime.getInstanceByUid(uid));
}