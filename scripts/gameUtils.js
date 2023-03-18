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
  const numFacilitiesOnPlanet = JSON.parse(planet.instVars.facilityList).length;
  if (planet.instVars.totalFacilitySlots <= numFacilitiesOnPlanet)
    return "No available slots on this planet to build a new facility."
  const facilityData = JSON.parse(runtime.globalVars.facilityDataMapping)[facilityName];
  if (facilityData["Quantia Drain"] > getQuantiaRate(runtime) - getQuantiaDrain(runtime))
    return "Insufficient quantia generation to power this facility.";
  const stellium = runtime.objects.GameController.getFirstInstance().instVars.stelliumStockpile;
  if (facilityData["Stellium Cost"] > stellium)
    return "Insufficient stellium in stockpile to build this facility.";
  return false;
}

/**
 * TODO
 * @param {*} runtime 
 * @param {*} facilityUid 
 */
export function isFacilityUpgradePrevented(runtime, facilityUid) {

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
  const facilityData = JSON.parse(runtime.globalVars.facilityDataMapping)[facilityName];
  const facility = runtime.objects.Facility.createInstance("Facilities", planet.x, planet.y, "", "");
  facility.setAnimation(facilityData.Animation);
  facility.behaviors.Rotate.speed = planet.behaviors.Rotate.speed;
  const numFacilitiesOnPlanet = JSON.parse(planet.instVars.facilityList).length;
  facility.angleDegrees = 360 / planet.instVars.totalFacilitySlots * (numFacilitiesOnPlanet + 1);
  facility.angleDegrees += planet.angleDegrees;
  planet.instVars.quantiaRate += facilityData["Quantia Rate"];
  planet.instVars.stelliumRate += facilityData["Stellium Rate"];
  const unpackedFacilityList = JSON.parse(planet.instVars.facilityList);
  unpackedFacilityList.push(facility.uid);
  planet.instVars.facilityList = JSON.stringify(unpackedFacilityList);
  if (facilityName === "Warp Depot") connectNearbyPlanets(runtime, planetUid);

  // Consume resources
  const gameController = runtime.objects.GameController.getFirstInstance();
  gameController.instVars.stelliumStockpile -= facilityData["Stellium Cost"];
  planet.instVars.stelliumDrain += facilityData["Stellium Drain"];
  planet.instVars.quantiaDrain += facilityData["Quantia Drain"];
}

export function connectNearbyPlanets(runtime, planetUid, connectionDistance = null) {
  // TODO: only connect planets that are charted (exploration level > 0)
  if (connectionDistance === null) connectionDistance = runtime.globalVars.WARP_DEPOT_RADIUS;
  const planet = runtime.getInstanceByUid(planetUid);
  const planetsInRange = [];
  for (let testPlanet of runtime.objects.Planet.instances()) {
    if (testPlanet.uid === planet.uid) continue;
    const distanceAway = Math.hypot(testPlanet.x - planet.x, testPlanet.y - planet.y);
    if (connectionDistance >= distanceAway) planetsInRange.push(testPlanet);
  }
  const connectedPlanetUids = JSON.parse(planet.instVars.connectionList);
  for (let i = 0; i < planetsInRange.length; i++) {
    if (connectedPlanetUids.indexOf(planetsInRange[i].uid) === -1)
      connectedPlanetUids.push(planetsInRange[i].uid);
  }
  planet.instVars.connectionList = JSON.stringify(connectedPlanetUids);
  // TODO: add bi-directional connection when a connection is added
}

/**
 * TODO
 * @param {*} runtime 
 * @param {*} facilityUid 
 */
export function upgradeFacility(runtime, facilityUid) {

}

export function isPlanetSupplied(runtime, planetUid) {
  return getConnectedPlanets(runtime, planetUid).length > 0;
}

export function getConnectedPlanets(runtime, planetUid) {
  const planet = runtime.getInstanceByUid(planetUid);
  const connectedPlanetUids = JSON.parse(planet.instVars.connectionList);
  return connectedPlanetUids.map(uid => runtime.getInstanceByUid(uid));
}