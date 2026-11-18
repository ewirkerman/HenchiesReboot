/**
 * Standalone Dataset Extractor for Henchies 2 Abilities
 * 
 * Run this script via node (Requires Node 18+ for native fetch):
 *   node extract_abilities.mjs
 * 
 * It will output `llm_abilities_export.json` and `llm_cards_export.json` in the
 * current working directory.
 */

import fs from 'fs';
import { generateAbilityDescription } from '../src/language_description.js';

// Configuration mirrored from firebase.js
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyACHtGdXLq9TNZZchfrx46pUQcGb6ndtAI",
    projectId: "henchies-reboot"
};

/**
 * The Firestore REST API returns data in a strictly typed schema 
 * e.g., { name: { stringValue: "Piercing Strike" }, cost: { mapValue: ... } }
 * This recursive function cleans it into standard JSON.
 */
function mapValue(value) {
    if (!value) return null;
    if (value.stringValue !== undefined) return value.stringValue;
    if (value.integerValue !== undefined) return parseInt(value.integerValue, 10);
    if (value.doubleValue !== undefined) return parseFloat(value.doubleValue);
    if (value.booleanValue !== undefined) return value.booleanValue;
    if (value.nullValue !== undefined) return null;
    if (value.mapValue !== undefined) {
        return mapDocument(value.mapValue.fields);
    }
    if (value.arrayValue !== undefined) {
        return (value.arrayValue.values || []).map(mapValue);
    }
    return value;
}

function mapDocument(fields) {
    if (!fields) return {};
    const obj = {};
    for (const key in fields) {
        obj[key] = mapValue(fields[key]);
    }
    return obj;
}

/**
 * Authenticates anonymously to satisfy Firestore Security Rules,
 * mimicking the signInAnonymously flow in firebase.js.
 */
async function authenticateAnonymously() {
    console.log("🤫 Requesting Anonymous Auth Token...");
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_CONFIG.apiKey}`;

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnSecureToken: true })
    });

    const data = await res.json();
    if (data.error) {
        throw new Error(`Auth Failed: ${data.error.message}`);
    }

    console.log(`✅ Authenticated! Temporary UID: ${data.localId}`);
    return data.idToken;
}

/**
 * Fetches all abilities from the Firestore collection handling pagination.
 */
async function fetchAllAbilities(token) {
    let abilities = [];
    let pageToken = "";
    const baseUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents/abilities`;

    console.log("☁️ Fetching abilities collection from Firestore...");

    do {
        let url = baseUrl;
        if (pageToken) url += `?pageToken=${pageToken}`;

        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await res.json();
        if (data.error) {
            throw new Error(`Firestore Read Failed: ${data.error.message}`);
        }

        if (data.documents) {
            for (const doc of data.documents) {
                const parsed = mapDocument(doc.fields);

                // Exclude soft-deleted abilities per firebase.js logic
                if (!parsed.isDeleted) {
                    abilities.push(cleanAbilityForLLM(parsed));
                }
            }
        }
        pageToken = data.nextPageToken;
    } while (pageToken);

    return abilities;
}

/**
 * Fetches all cards from the Firestore collection to resolve entity names.
 */
async function fetchAllCards(token) {
    let cards = [];
    let pageToken = "";
    const baseUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents/cards`;

    console.log("☁️ Fetching cards collection from Firestore...");

    do {
        let url = baseUrl;
        if (pageToken) url += `?pageToken=${pageToken}`;

        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await res.json();
        if (data.error) {
            throw new Error(`Firestore Read Failed (Cards): ${data.error.message}`);
        }

        if (data.documents) {
            for (const doc of data.documents) {
                const parsed = mapDocument(doc.fields);

                // Firestore document names are full paths, extract the ID
                parsed.id = doc.name.split('/').pop();

                if (!parsed.isDeleted) {
                    cards.push(parsed);
                }
            }
        }
        pageToken = data.nextPageToken;
    } while (pageToken);

    return cards;
}

/**
 * Strips database noise to save context window tokens and improve LLM reasoning.
 */
function cleanAbilityForLLM(ability) {
    const cleaned = { ...ability };

    // Remove database noise / metadata
    delete cleaned.updatedAt;
    delete cleaned.createdAt;
    delete cleaned.isDeleted;

    // Sort keys alphabetically so the LLM has an easier time establishing patterns
    return Object.keys(cleaned).sort().reduce((acc, key) => {
        acc[key] = cleaned[key];
        return acc;
    }, {});
}

/**
 * Main execution runner
 */
async function run() {
    try {
        const token = await authenticateAnonymously();
        const abilities = await fetchAllAbilities(token);
        const cards = await fetchAllCards(token);

        console.log(`📦 Successfully extracted ${abilities.length} active abilities and ${cards.length} cards.`);
        console.log("🗣️ Applying Natural Language Generation (NLG) rules...");

        const dataset = abilities.map(ability => {
            let generatedLanguage = "";
            try {
                // We pass the full abilities list and cards so the NLG engine can resolve internal references (like granted abilities and summoned cards)
                generatedLanguage = generateAbilityDescription(ability, abilities, cards);
            } catch (e) {
                generatedLanguage = `[ERROR DURING GENERATION]: ${e.message}`;
            }

            // Output in the same structural format as language_generator.mjs
            return {
                input: ability,
                output: generatedLanguage
            };
        });

        const outputPath = './llm_abilities_export.json';
        fs.writeFileSync(outputPath, JSON.stringify(dataset, null, 2));

        const cardsOutputPath = './llm_cards_export.json';
        fs.writeFileSync(cardsOutputPath, JSON.stringify(cards, null, 2));

        console.log(`✅ Success! Dataset exported to ${outputPath}`);
        console.log(`✅ Cards exported to ${cardsOutputPath}`);
        console.log(`💡 You can now feed this JSON file to your LLM for balance analysis, rule validation, or data migration.`);

    } catch (error) {
        console.error("❌ Fatal Error during extraction:");
        console.error(error);
    }
}

// Run script
run();