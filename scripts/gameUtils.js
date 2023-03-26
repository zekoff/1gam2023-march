// gameUtils.js

const PLANET_TRAITS = {
  "Stellium Rich": "Stellium extraction rate increased on this planet.",
  "Quantia Clouds": "Quantia harvesting rate increased on this planet.",
  "Garden World": "Habitats on this planet contribute extra to improvement level.",
  "Large Landmasses": "Extra facility slots on this planet.",
  "Precursor Ruins": "Research Facilities give extra Crysether.",
  "Stellium Cache": "Grants additional Stellium to stockpile if in supply network.",
  "Crysether Cache": "Grants additional Crysether to stockpile if in supply network."
};

export function populateFacilityBuildPanel(runtime) {
  const facilityName = runtime.objects.GlassPanel.getFirstPickedInstance().instVars.handle;
  console.log(facilityName);
  const facilityData = JSON.parse(runtime.globalVars.facilityDataMapping)[facilityName];
  const facilityIcon = runtime.objects.FacilityIcon.getFirstPickedInstance();
  const facilityNameDisplay = runtime.objects.FacilityName.getFirstPickedInstance();
  const facilityDescriptionDisplay = runtime.objects.FacilityDescription.getFirstPickedInstance();
  facilityIcon.setAnimation(facilityData["Animation"]);
  facilityNameDisplay.text = facilityName;
  facilityDescriptionDisplay.text = facilityData["Description"];
}

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
  const stelliumRate = getStelliumRate(runtime) - getStelliumDrain(runtime);
  if (facilityData["Stellium Drain"] > stelliumRate)
    return "Inadequate Stellium extraction rate to maintain this facility.";
  const crysether = runtime.objects.GameController.getFirstInstance().instVars.crysetherStockpile;
  const gc = runtime.objects.GameController.getFirstInstance();
  if (facilityData["Crysether Cost"] > crysether || (facilityName === "Warp Depot" && gc.instVars.warpDepotCost > crysether))
    return "Insufficient crysether available to build this facility.";
  return false;
}

export function applyPlanetTraitRetroactively(runtime, planetUid) {
  const planet = runtime.getInstanceByUid(planetUid);
  const facilityDataMapping = JSON.parse(runtime.globalVars.facilityDataMapping);
  if (planet.instVars.explorationLevel !== 2) return;
  if (!planet.instVars.trait) return;
  switch (planet.instVars.trait) {
    case "Stellium Rich":
      planet.instVars.stelliumRate *= 2;
      break;
    case "Quantia Clouds":
      planet.instVars.quantiaRate *= 2;
      break;
    case "Garden World":
      const numHabitats = numFacilityOnPlanet(runtime, planet.uid, "Habitat");
      const habitatImprovementValue = facilityDataMapping["Habitat"]["Improvement Level"];
      planet.instVars.improvementLevel += numHabitats * habitatImprovementValue;
      break;
    case "Large Landmasses":
      planet.instVars.totalFacilitySlots += 2;
      let facilities = JSON.parse(planet.instVars.facilityList);
      facilities = facilities.map(uid => runtime.getInstanceByUid(uid));
      facilities.forEach((facility, index) => {
        facility.angleDegrees = 360 / planet.instVars.totalFacilitySlots * index;
        facility.angleDegrees += planet.angleDegrees;
      });
      break;
    case "Precursor Ruins":
      const numResearchFacilities = numFacilityOnPlanet(runtime, planet.uid, "Research Facility");
      gameController.instVars.crysetherStockpile += numResearchFacilities;
      break;
    case "Stellium Cache":
      runtime.objects.GameController.getFirstInstance().instVars.stelliumStockpile += 1000;
      break;
    case "Crysether Cache":
      runtime.objects.GameController.getFirstInstance().instVars.crysetherStockpile += 1;
      break;
    default:
      break;
  }
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
  facility.angleDegrees = 360 / planet.instVars.totalFacilitySlots * numFacilitiesOnPlanet;
  facility.angleDegrees += planet.angleDegrees;
  planet.instVars.quantiaRate += facilityData["Quantia Rate"];
  planet.instVars.stelliumRate += facilityData["Stellium Rate"];
  planet.instVars.improvementLevel += facilityData["Improvement Level"];
  gameController.instVars.crysetherStockpile += facilityData["Crysether Gain"];
  gameController.instVars.stelliumStockpile += facilityData["Stellium Gain"];
  const unpackedFacilityList = JSON.parse(planet.instVars.facilityList);
  unpackedFacilityList.push(facility.uid);
  planet.instVars.facilityList = JSON.stringify(unpackedFacilityList);
  if (facilityName === "Warp Depot") updatePlanetConnections(runtime);

  // Handle traits related to facility builds
  if (planet.instVars.explorationLevel === 2 && planet.instVars.trait) {
    switch (planet.instVars.trait) {
      case "Stellium Rich":
        planet.instVars.stelliumRate += facilityData["Stellium Rate"];
        break;
      case "Quantia Clouds":
        planet.instVars.quantiaRate += facilityData["Quantia Rate"];
        break;
      case "Garden World":
        if (facilityName === "Habitat") planet.instVars.improvementLevel += facilityData["Improvement Level"];
        break;
      case "Precursor Ruins":
        if (facilityName === "Research Facility") gameController.instVars.crysetherStockpile += 1;
        break;
      default:
        break;
    }
  }

  // Consume resources
  gameController.instVars.stelliumStockpile -= facilityData["Stellium Cost"];
  if (facilityName === "Warp Depot") {
    gameController.instVars.crysetherStockpile -= gameController.instVars.warpDepotCost;
  } else {
    gameController.instVars.crysetherStockpile -= facilityData["Crysether Cost"];
  }
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
    if (numFacilityOnPlanet(runtime, planet.uid, "Warp Depot") ||
      numFacilityOnPlanet(runtime, planet.uid, "Colony")) {
      connectNearbyPlanets(runtime, planet.uid, connectionDistance);
      for (const otherWarpDepotPlanet of warpDepotPlanets) {
        if (planet.uid !== otherWarpDepotPlanet.uid)
          connectNodes(runtime, planet.uid, otherWarpDepotPlanet.uid);
      }
    }
  }
};

/**
 * Check if a planet has the named facility present. Returns number of that facility on planet,
 * or zero if none are present.
 * @param {*} runtime Construct runtime
 * @param {*} planetUid UID of planet to check
 * @param {*} facilityName the name of the facility to check for
 * @returns number of the named facility on this planet
 */
export function numFacilityOnPlanet(runtime, planetUid, facilityName) {
  const planet = runtime.getInstanceByUid(planetUid);
  const facilityUids = JSON.parse(planet.instVars.facilityList);
  const facilities = facilityUids.map(uid => runtime.getInstanceByUid(uid));
  return facilities.filter(facility => facility.instVars.name === facilityName).length;
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
    if (numFacilityOnPlanet(runtime, planet.uid, "Warp Depot") ||
      numFacilityOnPlanet(runtime, planet.uid, "Colony")) planetsWithWarpDepots.push(planet);
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
    numFacilityOnPlanet(runtime, planetUid, "Colony");
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

/**
 * Update UI elements that display resource/status text each tick.
 * @param {*} runtime Construct runtime
 */
export function updateUiText(runtime) {
  const gameController = runtime.objects.GameController.getFirstInstance();
  runtime.objects.OverviewLine1Display.getFirstInstance().text =
    "Quantia Generation: " + (getQuantiaRate(runtime) - getQuantiaDrain(runtime)) + " surplus";
  runtime.objects.OverviewLine2Display.getFirstInstance().text =
    "Stellium: " + Math.floor(gameController.instVars.stelliumStockpile) + " (net extraction +" +
    (getStelliumRate(runtime) - getStelliumDrain(runtime)) + "/yr)";
  runtime.objects.OverviewTextDisplay.getFirstInstance().text =
    "Crysether Available: " + gameController.instVars.crysetherStockpile;
  const year = gameController.instVars.yearsElapsed;
  runtime.objects.YearDisplay.getFirstInstance().text = `Year:\n${Math.floor(year)}`;
}

export function generateRandomPlanetName(uid) {
  const PREFIXES = ["Alpha", "Beta", "Theta", "Gamma", "Epsilon", "Virgo", "Red", "Blue", "Green"];
  const NAMES = ["Veritas", "Mercurius", "Centauri", "Gandalfi", "Griffindus", "Tychus", "Aristotle",
    "Socrates", "Plato", "Kant", "Chidi", "Emma", "Jack", "Elizabeth", "Lauren", "Fortius", "Temperandi",
    "Basalt", "Shale", "Materia", "Personus"];
  const SUFFIXES = ["VI", "RT", "A", "B", "Z", "VII", "III", "II", "I"];
  const name = [];
  name.push(`${pickRandomFromList(...NAMES)}-${uid}`);
  if (Math.random() < .3) name.unshift(pickRandomFromList(...PREFIXES));
  if (Math.random() < .3) name.push(pickRandomFromList(...SUFFIXES));
  return name.join(" ");
}

function pickRandomFromList(...items) {
  return items[Math.floor(Math.random() * items.length)];
}

export function generateSector(runtime) {
  const PLANETS_TO_GENERATE = 100;
  const MINIMUM_DISTANCE_BETWEEN_PLANETS = 100;
  for (let i = 0; i < PLANETS_TO_GENERATE; i++) {
    const x = Math.random() * 5000 + 500;
    const y = Math.random() * 9000 + 500;
    const planet = runtime.objects.Planet.createInstance("Planets", x, y, false, "Standard Planet");
    planet.instVars.name = generateRandomPlanetName(planet.uid);
    if (Math.random() < .4) {
      planet.instVars.trait = pickRandomFromList(...Array.from(Object.keys(PLANET_TRAITS)));
    }
    planet.setAnimation("Animation " + Math.ceil(Math.random() * 10));
  }
}