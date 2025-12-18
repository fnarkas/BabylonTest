# Multiplayer Geography Party Game - Development Plan

## Vision
Transform the single-player globe into a multiplayer party game where 1-8 players compete using their phones while viewing a shared host screen.

## Game Flow
1. **Lobby** → Players join via QR code (handled by your brother)
2. **Question** → Question appears on all screens
3. **Answering** → Players place pins, host sees "answered" indicators
4. **Reveal** → All pins appear, arcs animate to correct answer, distances shown
5. **Results** → Leaderboard with scores
6. **Repeat** → Next question

---

## Current State

### ✅ What We Have
- 3D globe with country selection (`EarthGlobe` class)
- Pin placement system (`PinManager`)
- Modular architecture ready for multiplayer
- Lobby system (in progress by brother)

### 🎯 What's Needed
- Question bank and scoring system
- Host UI (question display, answer indicators, results)
- Mobile client (reusing `EarthGlobe`)
- WebSocket event handling
- Game state synchronization
- Arc animations

---

## Development Phases

## Phase 1: Question System & Scoring

**Goal**: Create question bank and distance-based scoring

### Core Components
```typescript
// shared/types.ts
interface Question {
  id: string;
  text: string;
  correctAnswer: { lat: number; lon: number };
  category?: string;
  imageUrl?: string;
}

interface PlayerAnswer {
  playerId: string;
  lat: number;
  lon: number;
  timestamp: number;
}
```

### Tasks
- [ ] Create `shared/types.ts` with Question, Player, GameState types
- [ ] Create `shared/geo.ts` with Haversine distance calculation
- [ ] Create `shared/scoring.ts` - formula: `max(0, 1000 - distance/10)`
- [ ] Create `server/questions/questions.json` with 20-30 questions
- [ ] Create `server/src/QuestionManager.ts` to select and serve questions

### Example Questions
```json
{
  "id": "q001",
  "text": "Where is the Eiffel Tower?",
  "correctAnswer": { "lat": 48.8584, "lon": 2.2945 }
}
```

---

## Phase 2: Host Game Flow

**Goal**: Host displays question, answer indicators, and results

### Architecture
Reuse `EarthGlobe` + add game UI overlays

### Components to Build
- `src/host/HostGameController.ts` - State machine for game flow
- `src/host/QuestionDisplay.ts` - Show question text/image
- `src/host/AnswerIndicators.ts` - Real-time "player answered" checkmarks
- `src/host/MultiPinManager.ts` - Display all player pins with colors
- `src/host/ArcAnimator.ts` - Animate arcs from answers to correct location
- `src/host/ResultsScreen.ts` - Leaderboard after each round

### Game States
```typescript
type GameState =
  | 'lobby'          // Waiting for players (brother's code)
  | 'question'       // Show question
  | 'answering'      // Players placing pins
  | 'reveal'         // Show all answers + arcs
  | 'results'        // Show leaderboard
```

### UI Layout
```
┌─────────────────────────────┐
│   Question Card (Top)       │  ← QuestionDisplay
├─────────────────────────────┤
│                             │
│      EarthGlobe             │  ← Existing component
│   (pins, arcs, countries)  │
│                             │
├─────────────────────────────┤
│ [✓ Alice] [✓ Bob] [ ] Eve  │  ← AnswerIndicators
└─────────────────────────────┘
```

### Tasks
- [ ] Create state machine in `HostGameController`
- [ ] Connect to Socket.io server
- [ ] Display current question
- [ ] Show answer indicators as players submit
- [ ] Reveal all pins when round ends
- [ ] Animate arcs (geodesic paths) to correct answer
- [ ] Display distances and points
- [ ] Show leaderboard modal

---

## Phase 3: Mobile Client

**Goal**: Players place pins on their phones

### Key Insight
**Reuse `EarthGlobe` class** - same 3D globe on mobile!

### Mobile-Specific Features
- Touch-optimized controls (pinch zoom, swipe rotate)
- Simplified UI (no complex overlays)
- "Submit Answer" button after pin placement
- Personal results display

### Components to Build
- `mobile/src/MobileApp.ts` - Main mobile controller
- `mobile/src/JoinScreen.ts` - Enter name (if not from lobby)
- `mobile/src/QuestionScreen.ts` - Show question + globe
- `mobile/src/ResultsScreen.ts` - Your distance, points, rank

### Screens
```
1. Join/Waiting → (handled by lobby)
2. Question + Globe → Place pin → Submit
3. Waiting for others → (lock screen)
4. Results → Your distance, rank
```

### Tasks
- [ ] Create `mobile/` Vite project
- [ ] Import and use `EarthGlobe` class
- [ ] Add touch controls for mobile
- [ ] Simple question display
- [ ] "Submit Answer" button
- [ ] Connect to Socket.io
- [ ] Handle all game states

---

## Phase 4: Multiplayer Synchronization

**Goal**: Keep host and all players in sync

### Server Responsibilities
- Manage game state
- Collect all answers before revealing
- Calculate distances and scores
- Broadcast state changes

### Core Socket Events
```typescript
// Server → Clients
'game:stateChange'     → { state: GameState }
'question:show'        → { question: Question }
'player:answered'      → { playerId: string }
'answers:reveal'       → { answers: PlayerAnswer[], correct: LatLon }
'results:show'         → { leaderboard: Player[] }

// Clients → Server
'answer:submit'        → { lat: number, lon: number }
'game:start'           → (host only)
'game:nextQuestion'    → (host only)
```

### State Flow
```
Host clicks "Start"
  ↓
Server: game:stateChange('question')
  ↓
Server: question:show → All clients
  ↓
Players submit answers
  ↓
Server: player:answered → All clients (for indicators)
  ↓
All answered? → Server: game:stateChange('reveal')
  ↓
Server: answers:reveal → All clients
  ↓
Host displays arcs, results
```

### Tasks
- [ ] Define events in `shared/events.ts`
- [ ] Implement event handlers in `server/src/GameRoom.ts`
- [ ] Add Socket.io client to host
- [ ] Add Socket.io client to mobile
- [ ] Handle disconnections/reconnections
- [ ] Test with multiple clients

---

## Phase 5: Animations & Polish

**Goal**: Make it feel like a real game

### Visual Effects
- **Arc Animation**: Draw geodesic path from each answer to correct location
  - Use Babylon.js `Lines` or custom geometry
  - Animate from 0% to 100% over 2 seconds
  - Color-code per player
- **Pin Drop**: Bounce animation when pins appear
- **Distance Counter**: Animate numbers from 0 to actual distance
- **Results Reveal**: Stagger leaderboard entries

### Performance
- Optimize globe for mobile (lower poly count)
- Lazy load assets
- Test with 8 concurrent connections

### Tasks
- [ ] Implement `ArcAnimator` with smooth bezier curves
- [ ] Add pin drop animation
- [ ] Score counting animation
- [ ] Responsive design for mobile
- [ ] Performance testing

---

## Technical Decisions

### Architecture
```
BabylonTest/
├── shared/           # Shared types, geo utils, scoring
│   ├── types.ts
│   ├── geo.ts
│   ├── scoring.ts
│   └── events.ts
│
├── server/           # Game server (Socket.io)
│   ├── src/
│   │   ├── index.ts
│   │   ├── GameRoom.ts
│   │   ├── QuestionManager.ts
│   │   └── ...
│   └── questions/
│       └── questions.json
│
├── src/              # Host app (existing + new)
│   ├── host/         # NEW: Host-specific UI
│   │   ├── HostGameController.ts
│   │   ├── QuestionDisplay.ts
│   │   ├── AnswerIndicators.ts
│   │   ├── MultiPinManager.ts
│   │   ├── ArcAnimator.ts
│   │   └── ResultsScreen.ts
│   ├── game.ts       # Existing (may refactor)
│   ├── pinManager.ts # Existing (extend for multi-pin)
│   └── main.ts       # Existing (import HostGameController)
│
└── mobile/           # NEW: Mobile player app
    ├── src/
    │   ├── MobileApp.ts
    │   ├── QuestionScreen.ts
    │   └── ResultsScreen.ts
    └── index.html
```

### Key Reuse Strategy
- **EarthGlobe**: Used by both host and mobile (same class!)
- **PinManager**: Extended to `MultiPinManager` for host
- **CountryPicker**: Used by both for lat/lon → country mapping
- **Shared Types**: Question, Player, Answer types used everywhere

### Tech Stack
- **Server**: Node.js + Express + Socket.io
- **Host**: Existing Vite + TypeScript + Babylon.js
- **Mobile**: New Vite + TypeScript + Babylon.js (reuse components!)
- **Communication**: Socket.io WebSockets

---

## Milestones

### MVP 1: Core Loop (Phases 1-2)
- Server serves questions
- Host displays question
- Host shows "player answered" indicators
- Basic reveal (no arcs yet)
- Simple results screen

**Success**: Can play one round with placeholder mobile client

### MVP 2: Mobile + Full Sync (Phases 3-4)
- Mobile app functional
- Players can join and answer
- Full state synchronization
- Multi-round gameplay

**Success**: 2+ players can complete full game

### MVP 3: Polish (Phase 5)
- Arc animations
- Smooth transitions
- Performance optimized

**Success**: 8 players, polished experience

---

## Getting Started

### Immediate Next Steps (After Lobby is Ready)

1. **Set up shared types**
   ```bash
   mkdir shared
   touch shared/types.ts shared/geo.ts shared/scoring.ts
   ```

2. **Create question bank**
   ```bash
   mkdir -p server/questions
   # Add questions.json with 20 questions
   ```

3. **Implement distance calculation**
   ```typescript
   // shared/geo.ts
   export function calculateDistance(
     lat1: number, lon1: number,
     lat2: number, lon2: number
   ): number {
     // Haversine formula
   }
   ```

4. **Build host question display**
   ```bash
   mkdir -p src/host
   # Create HostGameController, QuestionDisplay
   ```

5. **Test with mock data before mobile**
   - Simulate player answers
   - Test reveal sequence
   - Verify scoring

---

## Notes & Considerations

### Must Have for MVP
- ✅ Question display
- ✅ Answer submission
- ✅ Distance calculation
- ✅ Basic scoring
- ✅ Multi-round gameplay
- ✅ Leaderboard

### Nice to Have
- Timer per question
- Answer speed bonus
- Sound effects
- Advanced animations

### Future Ideas
- Custom question packs
- Categories
- Team mode
- Photo questions

---

## Dependencies

### New Packages Needed
```json
{
  "server": {
    "socket.io": "^4.6.0",
    "express": "^4.18.0"
  },
  "host + mobile": {
    "socket.io-client": "^4.6.0"
  }
}
```

### Existing Packages (Reuse)
- Babylon.js (host and mobile)
- Vite (host and mobile)
- TypeScript (all projects)

---

## Success Criteria

**We've succeeded when:**
1. ✅ Host shows question
2. ✅ 2-8 players join on phones
3. ✅ Players place pins on globe
4. ✅ Host shows who has answered (real-time)
5. ✅ Reveal shows all answers + distances
6. ✅ Correct scoring and leaderboard
7. ✅ Multiple rounds work smoothly
8. ✅ Fun to play! 🎉
