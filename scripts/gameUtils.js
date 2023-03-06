// gameUtils.js

/**
 * Get the current Quantia income/rate across the sector.
 */
export function getQuantiaRate(runtime) {
  let quantiaRate = 0;
  for (const planet of runtime.objects.Planet.instances()) {
    quantiaRate += planet.instVars.quantiaRate;
  }
  return quantiaRate;
}

/**
 * Get the current Stellium income/rate across the sector.
 */
export function getStelliumRate(runtime) {
  let stelliumRate = 0;
  for (const planet of runtime.objects.Planet.instances()) {
    stelliumRate += planet.instVars.stelliumRate;
  }
  return stelliumRate;
}

/**
 * Check if a facility can be built on a planet.
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
  if (facilityData["Quantia Drain"] > getQuantiaRate(runtime))
    return "Insufficient quantia generation to power this facility.";
  if (facilityData["Stellium Cost"] > runtime.globalVars["stelliumStockpile"])
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
  // TODO rotation speed is not being set correctly
  facility.behaviors.Rotate.Speed = planet.behaviors.Rotate.Speed;
  const numFacilitiesOnPlanet = JSON.parse(planet.instVars.facilityList).length;
  facility.angleDegrees = 360 / (numFacilitiesOnPlanet + 1);
  facility.angleDegrees += planet.angleDegrees;
  // TODO angle is not being set correctly
  planet.instVars.quantiaRate += facilityData["Quantia Rate"];
  planet.instVars.stelliumRate += facilityData["Stellium Rate"];
  const unpackedFacilityList = JSON.parse(planet.instVars.facilityList);
  unpackedFacilityList.push(facility.uid);
  planet.instVars.facilityList = JSON.stringify(unpackedFacilityList);
  // TODO update supply network if Warp Depot
}

/**
 * TODO
 * @param {*} runtime 
 * @param {*} facilityUid 
 */
export function upgradeFacility(runtime, facilityUid) {

}