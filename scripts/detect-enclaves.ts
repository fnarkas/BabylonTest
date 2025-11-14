#!/usr/bin/env node
/**
 * Detect Enclaves Script
 *
 * Analyzes countries.json to find countries completely contained within others
 * (e.g., Lesotho inside South Africa, Vatican inside Italy)
 *
 * Outputs: public/countries-with-holes.json
 */

import * as fs from 'fs';
import * as path from 'path';

interface Point {
    lat: number;
    lon: number;
}

interface CountryJSON {
    name_en: string;
    iso2: string;
    paths: string;
    continent: string;
    is_sovereign?: boolean;
}

interface Polygon {
    points: Point[];
}

interface CountryWithHoles extends CountryJSON {
    holes?: string[][]; // Array of hole ISO2 codes per polygon
}

/**
 * Ray-casting algorithm for point-in-polygon test (2D)
 * Works in lat/lon space
 */
function pointInPolygon(point: Point, polygon: Point[]): boolean {
    const x = point.lat;
    const y = point.lon;
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].lat;
        const yi = polygon[i].lon;
        const xj = polygon[j].lat;
        const yj = polygon[j].lon;

        const intersect = ((yi > y) !== (yj > y)) &&
            (x < (xj - xi) * (y - yi) / (yj - yi) + xi);

        if (intersect) inside = !inside;
    }

    return inside;
}

/**
 * Check if all points of polygonB are inside polygonA
 */
function polygonContainsPolygon(polygonA: Point[], polygonB: Point[]): boolean {
    // Check if all points of B are inside A
    for (const point of polygonB) {
        if (!pointInPolygon(point, polygonA)) {
            return false;
        }
    }
    return true;
}

/**
 * Parse polygon data from JSON string
 */
function parsePolygons(pathsString: string): Polygon[] {
    const paths = JSON.parse(pathsString) as number[][][];
    return paths.map(path => ({
        points: path.map(([lat, lon]) => ({ lat, lon }))
    }));
}

/**
 * Calculate bounding box for quick rejection
 */
function getBoundingBox(polygon: Point[]) {
    let minLat = Infinity, maxLat = -Infinity;
    let minLon = Infinity, maxLon = -Infinity;

    for (const point of polygon) {
        minLat = Math.min(minLat, point.lat);
        maxLat = Math.max(maxLat, point.lat);
        minLon = Math.min(minLon, point.lon);
        maxLon = Math.max(maxLon, point.lon);
    }

    return { minLat, maxLat, minLon, maxLon };
}

/**
 * Quick bounding box overlap check
 */
function boundingBoxesOverlap(bb1: any, bb2: any): boolean {
    return !(bb1.maxLat < bb2.minLat || bb1.minLat > bb2.maxLat ||
             bb1.maxLon < bb2.minLon || bb1.minLon > bb2.maxLon);
}

/**
 * Main detection logic
 */
function detectEnclaves(countries: CountryJSON[]): CountryWithHoles[] {
    console.log(`Analyzing ${countries.length} countries for enclaves...`);
    const startTime = performance.now();

    // Pre-process: parse all polygons and compute bounding boxes
    const countryData = countries.map(country => {
        const polygons = parsePolygons(country.paths);
        const boundingBoxes = polygons.map(p => getBoundingBox(p.points));
        return {
            country,
            polygons,
            boundingBoxes
        };
    });

    // Find enclaves
    const results: CountryWithHoles[] = [];
    let enclaveCount = 0;

    for (let i = 0; i < countryData.length; i++) {
        const containerData = countryData[i];
        const holesPerPolygon: string[][] = containerData.polygons.map(() => []);

        // Check each other country to see if it's contained
        for (let j = 0; j < countryData.length; j++) {
            if (i === j) continue; // Skip self

            const candidateData = countryData[j];

            // Check each polygon of the container against each polygon of the candidate
            for (let polyIdx = 0; polyIdx < containerData.polygons.length; polyIdx++) {
                const containerPolygon = containerData.polygons[polyIdx];
                const containerBBox = containerData.boundingBoxes[polyIdx];

                // Check if candidate is fully contained in this polygon
                let allCandidatePolygonsContained = true;

                for (let candPolyIdx = 0; candPolyIdx < candidateData.polygons.length; candPolyIdx++) {
                    const candidatePolygon = candidateData.polygons[candPolyIdx];
                    const candidateBBox = candidateData.boundingBoxes[candPolyIdx];

                    // Quick rejection: bounding boxes must overlap
                    if (!boundingBoxesOverlap(containerBBox, candidateBBox)) {
                        allCandidatePolygonsContained = false;
                        break;
                    }

                    // Detailed check: all points must be inside
                    if (!polygonContainsPolygon(containerPolygon.points, candidatePolygon.points)) {
                        allCandidatePolygonsContained = false;
                        break;
                    }
                }

                // If all candidate polygons are inside this container polygon, it's a hole
                if (allCandidatePolygonsContained) {
                    holesPerPolygon[polyIdx].push(candidateData.country.iso2);
                    enclaveCount++;
                    console.log(`  ✓ Found enclave: ${candidateData.country.name_en} (${candidateData.country.iso2}) inside ${containerData.country.name_en} (${containerData.country.iso2})`);
                }
            }
        }

        // Create result with holes if any found
        const result: CountryWithHoles = { ...containerData.country };
        const hasHoles = holesPerPolygon.some(holes => holes.length > 0);
        if (hasHoles) {
            result.holes = holesPerPolygon;
        }
        results.push(result);
    }

    const endTime = performance.now();
    console.log(`\nDetection complete in ${(endTime - startTime).toFixed(2)}ms`);
    console.log(`Found ${enclaveCount} enclaves\n`);

    return results;
}

/**
 * Main function
 */
async function main() {
    try {
        // Load countries.json
        const inputPath = path.join(process.cwd(), 'public', 'countries.json');
        const outputPath = path.join(process.cwd(), 'public', 'countries-with-holes.json');

        console.log('Loading countries.json...');
        const countriesData = JSON.parse(fs.readFileSync(inputPath, 'utf-8')) as CountryJSON[];
        console.log(`Loaded ${countriesData.length} countries\n`);

        // Detect enclaves
        const countriesWithHoles = detectEnclaves(countriesData);

        // Write output
        console.log(`Writing to ${path.relative(process.cwd(), outputPath)}...`);
        fs.writeFileSync(outputPath, JSON.stringify(countriesWithHoles, null, 2));

        // Summary
        const countriesWithHolesCount = countriesWithHoles.filter(c => c.holes).length;
        console.log(`\n=== Summary ===`);
        console.log(`Total countries: ${countriesWithHoles.length}`);
        console.log(`Countries with holes: ${countriesWithHolesCount}`);
        console.log(`Output: ${outputPath}`);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main();
