// gameUtils.js

/**
 * Get the current Quantia income/rate across the sector.
 */
export function getQuantiaRate(runtime) {
  let quantiaRate = 0;
  for (const planet of runtime.objects.Planet.instances()) {
    quantiaRate += planet.instVars.QuantiaRate;
  }
  return quantiaRate;
}

/**
 * Get the current Stellium income/rate across the sector.
 */
export function getStelliumRate(runtime) {
  let stelliumRate = 0;
  for (const planet of runtime.objects.Planet.instances()) {
    stelliumRate += planet.instVars.StelliumRate;
  }
  return stelliumRate;
}

/**
 * Check if a facility can be built on a planet.
 * 
 * Returns a user-readable error message if the facility cannot be built, or
 * false if the facility build is not prevented (i.e. the facility can be built).
 */
export function isFacilityPrevented(runtime, planetUid, facilityName) {
  
}

/**
 * Construct a facility on the designated planet. Does not verify that constraints
 * are met to construct the facility (enough resources, slots on target planet, etc.).
 * @param {*} runtime 
 * @param {*} planetUid 
 * @param {*} facilityName 
 */
export function buildFacilityOnPlanet(runtime, planetUid, facilityName) {
  
}