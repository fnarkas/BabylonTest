#!/usr/bin/env node
/**
 * Test script for segment loader
 */

import { loadSegments, getSegmentsBetween, getSharedSegments, getSegmentStats } from '../src/segmentLoader';
import * as fs from 'fs';
import * as path from 'path';

// Mock fetch for Node.js environment
const __dirname = path.dirname(new URL(import.meta.url).pathname);
global.fetch = async (url: string) => {
    const filePath = path.join(__dirname, '..', 'public', url);
    const data = fs.readFileSync(filePath, 'utf-8');
    return {
        ok: true,
        json: async () => JSON.parse(data)
    } as Response;
};

console.log('=== Testing Segment Loader ===\n');

async function runTests() {
    try {
        // Test 1: Load segments
        console.log('Test 1: Load segments.json');
        const segmentData = await loadSegments('segments.json');
        console.log(`  ✓ Loaded ${segmentData.segments.length} segments`);
        console.log(`  ✓ Indexed ${segmentData.segmentsByCountry.size} countries`);

        // Test 2: Verify 3D conversion
        console.log('\nTest 2: Verify 3D conversion');
        const firstSegment = segmentData.segments[0];
        console.log(`  Points in first segment: ${firstSegment.points.length}`);
        console.log(`  First point: (${firstSegment.points[0].x.toFixed(4)}, ${firstSegment.points[0].y.toFixed(4)}, ${firstSegment.points[0].z.toFixed(4)})`);

        // Check that points are on the sphere (distance from origin should be ~EARTH_RADIUS)
        const distance = Math.sqrt(
            firstSegment.points[0].x ** 2 +
            firstSegment.points[0].y ** 2 +
            firstSegment.points[0].z ** 2
        );
        const expectedRadius = 2.0 + 0.09; // EARTH_RADIUS + BORDER_LINE_ALTITUDE
        const isOnSphere = Math.abs(distance - expectedRadius) < 0.01;
        console.log(`  Point distance from origin: ${distance.toFixed(4)} (expected ~${expectedRadius.toFixed(4)})`);
        console.log(isOnSphere ? '  ✓ Points are on sphere surface' : '  ✗ Points are NOT on sphere surface');

        // Test 3: Get shared segments
        console.log('\nTest 3: Get shared segments');
        const sharedSegments = getSharedSegments(segmentData);
        console.log(`  ✓ Found ${sharedSegments.length} shared segments`);

        // Show first 5
        console.log('\n  First 5 shared borders:');
        for (let i = 0; i < Math.min(5, sharedSegments.length); i++) {
            const seg = sharedSegments[i];
            console.log(`    ${i + 1}. ${seg.countries.join(' ↔ ')}: ${seg.points.length} points`);
        }

        // Test 4: Belgium-Netherlands border
        console.log('\nTest 4: Belgium-Netherlands border');
        const beNlSegments = getSegmentsBetween(segmentData, 'BE', 'NL');
        console.log(`  Segments found: ${beNlSegments.length}`);

        if (beNlSegments.length > 0) {
            const seg = beNlSegments[0];
            console.log(`  ✓ Found border segment`);
            console.log(`    Countries: ${seg.countries.join(', ')}`);
            console.log(`    Type: ${seg.type}`);
            console.log(`    Points: ${seg.points.length}`);
            console.log(`    First 3D point: (${seg.points[0].x.toFixed(4)}, ${seg.points[0].y.toFixed(4)}, ${seg.points[0].z.toFixed(4)})`);
        } else {
            throw new Error('Belgium-Netherlands border not found!');
        }

        // Test 5: Statistics
        console.log('\nTest 5: Segment statistics');
        const stats = getSegmentStats(segmentData);
        console.log(`  Total segments: ${stats.totalSegments}`);
        console.log(`  Shared (2 countries): ${stats.sharedSegments}`);
        console.log(`  Multi-point (3+ countries): ${stats.multiPointSegments}`);
        console.log(`  Standalone (coastlines): ${stats.standaloneSegments}`);
        console.log(`  Total points: ${stats.totalPoints.toLocaleString()}`);
        console.log(`  Avg points/segment: ${stats.avgPointsPerSegment.toFixed(1)}`);
        console.log(`  Countries with segments: ${stats.countriesWithSegments}`);

        // Verify expected values
        if (stats.totalSegments !== 313) {
            throw new Error(`Expected 313 segments, got ${stats.totalSegments}`);
        }
        console.log('  ✓ Segment count matches expected value (313)');

        // Final result
        console.log('\n=== All tests passed ===');
        process.exit(0);

    } catch (error) {
        console.error('\n✗ Test failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

runTests();
