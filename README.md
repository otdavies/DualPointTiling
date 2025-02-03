# Dual-Point Texture Tiling Demo

Interactive demonstration of a texture tiling technique that uses dual-point rotation blending to create seamless textures with reduced repetition artifacts.

[View Demo](https://otdavies.github.io/texture-tiling-demo)

## How it works
The algorithm uses two reference points (corners and centers) to create random rotations of the texture, then blends between them based on distance. This creates a more natural-looking tiling pattern that reduces the obvious repetition typically seen in tiled textures.

## Controls
- Rotation: Controls the maximum rotation amount
- Blend Falloff: Adjusts how sharply the algorithm transitions between rotated sections
- Blend Offset: Modifies the center point influence
- Scale: Adjusts the tiling scale
