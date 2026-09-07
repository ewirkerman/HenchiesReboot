export default {
    // Tells Jest not to transform .js files, letting Node handle the ES Modules natively
    transform: {},
    // Use the node environment for our tabletop engine tests
    testEnvironment: "node",
    // Run our DOM mocks before any ES module imports are evaluated
    setupFiles: ["<rootDir>/tests/setup.js"],
    // Force Jest to recursively scan the tests directory for anything ending in .test.js
    roots: ["<rootDir>/tests"],
    testMatch: ["**/*.test.js"],
    moduleNameMapper: {
        "(.*)firebase\\.js$": "<rootDir>/tests/__mocks__/firebase.mock.js"
    }
};