// constructUtils.js

/**
 * Given a Construct 2D array, treat the first row as header info and unpack
 * each data row into a dict.
 * 
 * The first column of each data row will be the key in an outer map.
 * The value for each key will be a map (object). That object will have
 * an attribute for each column in the header row, and that attribute's
 * value will be the data row's contents. For any empty column, the value
 * at that attribute will be an empty string.
 * 
 * Example Construct array:
 * 0) Name   Cost    Power
 * 1) Test   2       Low
 * 2) Test2          5
 * 
 * Result object:
 * {
 *   "Test": {
 *      "Cost": 2,
 *      "Power": "Low"
 *    },
 *   "Test2": {
 *      "Cost": "",
 *      "Power": 5
 *    }
 * }
 * 
 * @param {*} array the Construct array to unpack
 */
export function unpackArrayToMapping(array) {
  if (!array) return {};
  if (array.width * array.height * array.depth === 0) return {};
  if (array.height === 1) return {};
  const headers = [];
  for (let i = 0; i < array.width; i++) {
    headers.push(String(array.getAt(i)));
  }
  const mapping = {};
  for (let row = 1; row < array.height; row++) {
    const data = {};
    for (let col = 1; col < array.width; col++) {
      let value = array.getAt(col, row);
      if (value === "") value = null;
      data[headers[col]] = value;
    }
    mapping[array.getAt(0, row)] = data;
  }
  return mapping;
}

/**
 * Get a random floating-point number between the lower and upper bounds.
 * Uses Math.random(), so cannot be seeded.
 * 
 * @param {*} lowerBound lowest number possible, inclusive
 * @param {*} upperBound highest number possible, inclusive
 */
export function getRandomNumberInRange(lowerBound = 0, upperBound = 100) {
  if (upperBound < lowerBound) return 0;
  const range = upperBound - lowerBound;
  const normalizedRandomResult = Math.random() * range;
  return lowerBound + normalizedRandomResult;
}