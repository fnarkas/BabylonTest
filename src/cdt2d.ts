/**
 * Constrained Delaunay Triangulation (CDT) in 2D
 * Based on cdt2d by Mikola Lysenko (MIT License)
 * Simplified and converted to TypeScript with hole support
 */

type Point = [number, number];
type Edge = [number, number];
type Triangle = [number, number, number];

// ============================================================================
// Binary Search Bounds
// ============================================================================

function bsearchGe<T>(a: T[], y: T, c: (a: T, b: T) => number): number {
    let l = 0, h = a.length - 1;
    let i = h + 1;
    while (l <= h) {
        const m = (l + h) >>> 1;
        const x = a[m];
        const p = c(x, y);
        if (p >= 0) { i = m; h = m - 1; } else { l = m + 1; }
    }
    return i;
}

function bsearchGt<T>(a: T[], y: T, c: (a: T, b: T) => number): number {
    let l = 0, h = a.length - 1;
    let i = h + 1;
    while (l <= h) {
        const m = (l + h) >>> 1;
        const x = a[m];
        const p = c(x, y);
        if (p > 0) { i = m; h = m - 1; } else { l = m + 1; }
    }
    return i;
}

function bsearchLt<T>(a: T[], y: T, c: (a: T, b: T) => number): number {
    let l = 0, h = a.length - 1;
    let i = l - 1;
    while (l <= h) {
        const m = (l + h) >>> 1;
        const x = a[m];
        const p = c(x, y);
        if (p < 0) { i = m; l = m + 1; } else { h = m - 1; }
    }
    return i;
}

function bsearchLe<T>(a: T[], y: T, c: (a: T, b: T) => number): number {
    let l = 0, h = a.length - 1;
    let i = l - 1;
    while (l <= h) {
        const m = (l + h) >>> 1;
        const x = a[m];
        const p = c(x, y);
        if (p <= 0) { i = m; l = m + 1; } else { h = m - 1; }
    }
    return i;
}

function bsearchEq<T>(a: T[], y: T, c: (a: T, b: T) => number): number {
    let l = 0, h = a.length - 1;
    while (l <= h) {
        const m = (l + h) >>> 1;
        const x = a[m];
        const p = c(x, y);
        if (p === 0) { return m; }
        if (p <= 0) { l = m + 1; } else { h = m - 1; }
    }
    return -1;
}

// ============================================================================
// Geometry Predicates
// ============================================================================

/**
 * Orient2D: Returns positive if a,b,c are counterclockwise, negative if clockwise, 0 if collinear
 */
function orient2d(a: Point, b: Point, c: Point): number {
    return (a[1] - c[1]) * (b[0] - c[0]) - (a[0] - c[0]) * (b[1] - c[1]);
}

/**
 * InCircle: Returns positive if d is inside circle through a,b,c (assuming ccw orientation)
 */
function inCircle(a: Point, b: Point, c: Point, d: Point): number {
    const adx = a[0] - d[0];
    const ady = a[1] - d[1];
    const bdx = b[0] - d[0];
    const bdy = b[1] - d[1];
    const cdx = c[0] - d[0];
    const cdy = c[1] - d[1];

    const abdet = adx * bdy - bdx * ady;
    const bcdet = bdx * cdy - cdx * bdy;
    const cadet = cdx * ady - adx * cdy;
    const alift = adx * adx + ady * ady;
    const blift = bdx * bdx + bdy * bdy;
    const clift = cdx * cdx + cdy * cdy;

    return alift * bcdet + blift * cadet + clift * abdet;
}

// ============================================================================
// Triangulation Data Structure
// ============================================================================

class Triangulation {
    stars: number[][];
    edges: Edge[];

    constructor(numVerts: number, edges: Edge[]) {
        this.stars = new Array(numVerts);
        for (let i = 0; i < numVerts; i++) {
            this.stars[i] = [];
        }
        this.edges = edges;
    }

    isConstraint(i: number, j: number): boolean {
        const e: Edge = [Math.min(i, j), Math.max(i, j)];
        return bsearchEq(this.edges, e, compareLex) >= 0;
    }

    removeTriangle(i: number, j: number, k: number): void {
        removePair(this.stars[i], j, k);
        removePair(this.stars[j], k, i);
        removePair(this.stars[k], i, j);
    }

    addTriangle(i: number, j: number, k: number): void {
        this.stars[i].push(j, k);
        this.stars[j].push(k, i);
        this.stars[k].push(i, j);
    }

    opposite(j: number, i: number): number {
        const list = this.stars[i];
        for (let k = 1; k < list.length; k += 2) {
            if (list[k] === j) {
                return list[k - 1];
            }
        }
        return -1;
    }

    flip(i: number, j: number): void {
        const a = this.opposite(i, j);
        const b = this.opposite(j, i);
        this.removeTriangle(i, j, a);
        this.removeTriangle(j, i, b);
        this.addTriangle(i, b, a);
        this.addTriangle(j, a, b);
    }

    cells(): Triangle[] {
        const result: Triangle[] = [];
        for (let i = 0; i < this.stars.length; i++) {
            const list = this.stars[i];
            for (let j = 0; j < list.length; j += 2) {
                const s = list[j];
                const t = list[j + 1];
                if (i < Math.min(s, t)) {
                    result.push([i, s, t]);
                }
            }
        }
        return result;
    }
}

function removePair(list: number[], j: number, k: number): void {
    const n = list.length;
    for (let i = 1; i < n; i += 2) {
        if (list[i - 1] === j && list[i] === k) {
            list[i - 1] = list[n - 2];
            list[i] = list[n - 1];
            list.length = n - 2;
            return;
        }
    }
}

function compareLex(a: Edge, b: Edge): number {
    return a[0] - b[0] || a[1] - b[1];
}

// ============================================================================
// Monotone Triangulation (Sweep Line)
// ============================================================================

const EVENT_POINT = 0;
const EVENT_END = 1;
const EVENT_START = 2;

interface PartialHull {
    a: Point;
    b: Point;
    idx: number;
    lowerIds: number[];
    upperIds: number[];
}

interface Event {
    a: Point;
    b: Point | null;
    type: number;
    idx: number;
}

function compareEvent(a: Event, b: Event): number {
    let d = (a.a[0] - b.a[0]) || (a.a[1] - b.a[1]) || (a.type - b.type);
    if (d) return d;
    if (a.type !== EVENT_POINT && a.b && b.b) {
        d = orient2d(a.a, a.b, b.b);
        if (d) return d;
    }
    return a.idx - b.idx;
}

function testPoint(hull: PartialHull, p: Point): number {
    return orient2d(hull.a, hull.b, p);
}

function addPoint(cells: Triangle[], hulls: PartialHull[], points: Point[], p: Point, idx: number): void {
    const lo = bsearchLt(hulls, p as any, testPoint as any);
    const hi = bsearchGt(hulls, p as any, testPoint as any);

    for (let i = lo; i < hi; i++) {
        const hull = hulls[i];

        // Insert p into lower hull
        const lowerIds = hull.lowerIds;
        let m = lowerIds.length;
        while (m > 1 && orient2d(points[lowerIds[m - 2]], points[lowerIds[m - 1]], p) > 0) {
            cells.push([lowerIds[m - 1], lowerIds[m - 2], idx]);
            m -= 1;
        }
        lowerIds.length = m;
        lowerIds.push(idx);

        // Insert p into upper hull
        const upperIds = hull.upperIds;
        m = upperIds.length;
        while (m > 1 && orient2d(points[upperIds[m - 2]], points[upperIds[m - 1]], p) < 0) {
            cells.push([upperIds[m - 2], upperIds[m - 1], idx]);
            m -= 1;
        }
        upperIds.length = m;
        upperIds.push(idx);
    }
}

function findSplit(hull: PartialHull, edge: Event): number {
    let d: number;
    if (hull.a[0] < edge.a[0]) {
        d = orient2d(hull.a, hull.b, edge.a);
    } else {
        d = orient2d(edge.b!, edge.a, hull.a);
    }
    if (d) return d;
    if (edge.b![0] < hull.b[0]) {
        d = orient2d(hull.a, hull.b, edge.b!);
    } else {
        d = orient2d(edge.b!, edge.a, hull.b);
    }
    return d || hull.idx - edge.idx;
}

function splitHulls(hulls: PartialHull[], points: Point[], event: Event): void {
    const splitIdx = bsearchLe(hulls, event as any, findSplit as any);
    const hull = hulls[splitIdx];
    const upperIds = hull.upperIds;
    const x = upperIds[upperIds.length - 1];
    hull.upperIds = [x];
    hulls.splice(splitIdx + 1, 0, {
        a: event.a,
        b: event.b!,
        idx: event.idx,
        lowerIds: [x],
        upperIds: upperIds
    });
}

function mergeHulls(hulls: PartialHull[], points: Point[], event: Event): void {
    // Swap pointers for merge search
    const tmp = event.a;
    event.a = event.b!;
    event.b = tmp;
    const mergeIdx = bsearchEq(hulls, event as any, findSplit as any);
    const lower = hulls[mergeIdx - 1];
    const upper = hulls[mergeIdx];
    lower.upperIds = upper.upperIds;
    hulls.splice(mergeIdx, 1);
}

function monotoneTriangulate(points: Point[], edges: Edge[]): Triangle[] {
    const numPoints = points.length;
    const numEdges = edges.length;
    const events: Event[] = [];

    // Create point events
    for (let i = 0; i < numPoints; i++) {
        events.push({ a: points[i], b: null, type: EVENT_POINT, idx: i });
    }

    // Create edge events
    for (let i = 0; i < numEdges; i++) {
        const e = edges[i];
        const a = points[e[0]];
        const b = points[e[1]];
        if (a[0] < b[0]) {
            events.push({ a, b, type: EVENT_START, idx: i });
            events.push({ a: b, b: a, type: EVENT_END, idx: i });
        } else if (a[0] > b[0]) {
            events.push({ a: b, b: a, type: EVENT_START, idx: i });
            events.push({ a, b, type: EVENT_END, idx: i });
        }
    }

    // Sort events
    events.sort(compareEvent);

    // Initialize hull
    const minX = events[0].a[0] - (1 + Math.abs(events[0].a[0])) * Math.pow(2, -52);
    const hull: PartialHull[] = [{ a: [minX, 1], b: [minX, 0], idx: -1, lowerIds: [], upperIds: [] }];

    // Process events
    const cells: Triangle[] = [];
    for (const event of events) {
        if (event.type === EVENT_POINT) {
            addPoint(cells, hull, points, event.a, event.idx);
        } else if (event.type === EVENT_START) {
            splitHulls(hull, points, event);
        } else {
            mergeHulls(hull, points, event);
        }
    }

    return cells;
}

// ============================================================================
// Delaunay Refinement
// ============================================================================

function testFlip(points: Point[], triangulation: Triangulation, stack: number[], a: number, b: number, x: number): void {
    let y = triangulation.opposite(a, b);
    if (y < 0) return;

    if (b < a) {
        [a, b] = [b, a];
        [x, y] = [y, x];
    }

    if (triangulation.isConstraint(a, b)) return;

    if (inCircle(points[a], points[b], points[x], points[y]) < 0) {
        stack.push(a, b);
    }
}

function delaunayRefine(points: Point[], triangulation: Triangulation): void {
    const stack: number[] = [];
    const numPoints = points.length;
    const stars = triangulation.stars;

    for (let a = 0; a < numPoints; a++) {
        const star = stars[a];
        for (let j = 1; j < star.length; j += 2) {
            const b = star[j];
            if (b < a) continue;
            if (triangulation.isConstraint(a, b)) continue;

            const x = star[j - 1];
            let y = -1;
            for (let k = 1; k < star.length; k += 2) {
                if (star[k - 1] === b) {
                    y = star[k];
                    break;
                }
            }

            if (y < 0) continue;

            if (inCircle(points[a], points[b], points[x], points[y]) < 0) {
                stack.push(a, b);
            }
        }
    }

    while (stack.length > 0) {
        const b = stack.pop()!;
        const a = stack.pop()!;

        let x = -1, y = -1;
        const star = stars[a];
        for (let i = 1; i < star.length; i += 2) {
            const s = star[i - 1];
            const t = star[i];
            if (s === b) y = t;
            else if (t === b) x = s;
        }

        if (x < 0 || y < 0) continue;
        if (inCircle(points[a], points[b], points[x], points[y]) >= 0) continue;

        triangulation.flip(a, b);

        testFlip(points, triangulation, stack, x, a, y);
        testFlip(points, triangulation, stack, a, y, x);
        testFlip(points, triangulation, stack, y, b, x);
        testFlip(points, triangulation, stack, b, x, y);
    }
}

// ============================================================================
// Face Classification (Filter)
// ============================================================================

interface FaceIndex {
    cells: Triangle[];
    neighbor: number[];
    constraint: boolean[];
    flags: number[];
    active: number[];
    next: number[];
}

function compareCell(a: Triangle, b: Triangle): number {
    return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

function locateCell(cells: Triangle[], a: number, b: number, c: number): number {
    let x = a, y = b, z = c;
    if (b < c) {
        if (b < a) { x = b; y = c; z = a; }
    } else if (c < a) {
        x = c; y = a; z = b;
    }
    if (x < 0) return -1;
    const key: Triangle = [x, y, z];
    return bsearchEq(cells, key, compareCell);
}

function indexCells(triangulation: Triangulation): FaceIndex {
    const cells = triangulation.cells();
    const nc = cells.length;

    // Canonicalize cells
    for (const c of cells) {
        const x = c[0], y = c[1], z = c[2];
        if (y < z) {
            if (y < x) { c[0] = y; c[1] = z; c[2] = x; }
        } else if (z < x) {
            c[0] = z; c[1] = x; c[2] = y;
        }
    }
    cells.sort(compareCell);

    const flags = new Array(nc).fill(0);
    const active: number[] = [];
    const next: number[] = [];
    const neighbor = new Array(3 * nc);
    const constraint = new Array(3 * nc);

    for (let i = 0; i < nc; i++) {
        const c = cells[i];
        for (let j = 0; j < 3; j++) {
            const x = c[j], y = c[(j + 1) % 3];
            const a = neighbor[3 * i + j] = locateCell(cells, y, x, triangulation.opposite(y, x));
            const b = constraint[3 * i + j] = triangulation.isConstraint(x, y);
            if (a < 0) {
                if (b) {
                    next.push(i);
                } else {
                    active.push(i);
                    flags[i] = 1;
                }
            }
        }
    }

    return { cells, neighbor, constraint, flags, active, next };
}

function classifyFaces(triangulation: Triangulation, target: number): Triangle[] {
    const index = indexCells(triangulation);

    if (target === 0) {
        return index.cells;
    }

    let side = 1;
    let { active, next, flags, cells, constraint, neighbor } = index;

    while (active.length > 0 || next.length > 0) {
        while (active.length > 0) {
            const t = active.pop()!;
            if (flags[t] === -side) continue;
            flags[t] = side;

            for (let j = 0; j < 3; j++) {
                const f = neighbor[3 * t + j];
                if (f >= 0 && flags[f] === 0) {
                    if (constraint[3 * t + j]) {
                        next.push(f);
                    } else {
                        active.push(f);
                        flags[f] = side;
                    }
                }
            }
        }

        // Swap arrays and flip side
        [active, next] = [next, active];
        next.length = 0;
        side = -side;
    }

    // Filter cells by target flag
    return cells.filter((_, i) => flags[i] === target);
}

// ============================================================================
// Main CDT Function
// ============================================================================

function canonicalizeEdge(e: Edge): Edge {
    return [Math.min(e[0], e[1]), Math.max(e[0], e[1])];
}

function canonicalizeEdges(edges: Edge[]): Edge[] {
    return edges.map(canonicalizeEdge).sort(compareLex);
}

export interface CDTOptions {
    delaunay?: boolean;
    interior?: boolean;
    exterior?: boolean;
}

/**
 * Constrained Delaunay Triangulation
 * @param points Array of [x, y] coordinates
 * @param edges Array of [i, j] vertex index pairs for constrained edges
 * @param options Configuration options
 * @returns Array of [a, b, c] triangle vertex indices
 */
export function cdt2d(points: Point[], edges?: Edge[], options?: CDTOptions): Triangle[] {
    if (!edges) edges = [];
    if (!options) options = {};

    const delaunay = options.delaunay !== false;
    const interior = options.interior !== false;
    const exterior = options.exterior !== false;

    if ((!interior && !exterior) || points.length === 0) {
        return [];
    }

    // Initial triangulation via sweep line
    const cells = monotoneTriangulate(points, edges);

    // If we need filtering or Delaunay refinement, build the triangulation structure
    if (delaunay || interior !== exterior) {
        const triangulation = new Triangulation(points.length, canonicalizeEdges(edges));
        for (const f of cells) {
            triangulation.addTriangle(f[0], f[1], f[2]);
        }

        if (delaunay) {
            delaunayRefine(points, triangulation);
        }

        if (!exterior) {
            return classifyFaces(triangulation, -1);
        } else if (!interior) {
            return classifyFaces(triangulation, 1);
        } else {
            return triangulation.cells();
        }
    }

    return cells;
}

// ============================================================================
// Point-in-Polygon Test (for hole filtering)
// ============================================================================

/**
 * Test if a point is inside a polygon using ray casting
 */
export function pointInPolygon(point: Point, polygon: Point[]): boolean {
    const x = point[0], y = point[1];
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i][0], yi = polygon[i][1];
        const xj = polygon[j][0], yj = polygon[j][1];

        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
            inside = !inside;
        }
    }

    return inside;
}

/**
 * Get centroid of a triangle
 */
export function triangleCentroid(points: Point[], tri: Triangle): Point {
    const a = points[tri[0]];
    const b = points[tri[1]];
    const c = points[tri[2]];
    return [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3];
}

/**
 * Filter triangles to only those inside the boundary polygon
 * and outside any holes
 */
export function filterTriangles(
    points: Point[],
    triangles: Triangle[],
    boundary: Point[],
    holes?: Point[][]
): Triangle[] {
    return triangles.filter(tri => {
        const centroid = triangleCentroid(points, tri);

        // Must be inside the boundary
        if (!pointInPolygon(centroid, boundary)) {
            return false;
        }

        // Must not be inside any hole
        if (holes) {
            for (const hole of holes) {
                if (pointInPolygon(centroid, hole)) {
                    return false;
                }
            }
        }

        return true;
    });
}

export default cdt2d;
