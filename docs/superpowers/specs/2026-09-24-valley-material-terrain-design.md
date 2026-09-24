# Forest Valley Material And Terrain Design

## Goal

Make the central cabin and valley floor feel physically grounded by improving procedural material variation and embedding the architecture, path, and stream into a continuous terrain composition.

## Scope

- Keep the local GLB cabin and tree assets, story nodes, camera controls, loading reveal, and WebGL fallback unchanged.
- Improve wood, roof, stone, soil, grass, path, stream-bank, and water material response with deterministic local textures.
- Add a terrain elevation function shared by the cabin surroundings, path, stream banks, and valley shoulders.
- Preserve the foreground, midground, and background group ownership.

## Visual Design

1. **Material hierarchy:** wood uses directional grain and medium roughness; roof uses darker, irregular weathering; stone uses high roughness and cool variation; soil/grass use mottled color and AO; path and stream banks use lighter edge variation; water keeps a controlled low roughness and animated offset.
2. **Terrain embedding:** the cabin footprint sits in a shallow terrace with a lower stream-side edge and raised rear shoulder. The path follows the terrace falloff, while stream banks remain the lowest continuous ribbon.
3. **Spatial depth:** foreground rocks and understory stay crisp, the cabin remains the visual anchor in midground, and ridge materials remain muted through fog and reduced contrast.
4. **Motion and accessibility:** no automatic camera rotation is introduced; existing orbit, wheel zoom, story-node transitions, reduced-motion handling, and fallback behavior remain intact.

## Technical Approach

- Extend the existing canvas-texture helpers with deterministic grain/mottling profiles rather than downloading external textures.
- Add a small terrain-height helper and use it only for scene placement and material surfaces in `DioramaScene.tsx`.
- Keep source-contract tests in `DioramaScene.test.ts` for named terrain groups, material channels, and placement relationships.

## Acceptance Criteria

- The cabin foundation visibly intersects the terrace instead of floating above a flat floor.
- The path and stream banks share continuous height changes with the valley floor.
- Wood, roof, stone, soil, and path surfaces have distinguishable roughness/color variation under the existing lighting.
- Existing scene interaction and loading behavior remains covered by the current related test suite.
