#!/bin/bash

# FBX to glTF converter using Blender
# Usage: ./scripts/fbx-to-gltf.sh input.fbx [output.glb]

if [ $# -eq 0 ]; then
    echo "Usage: $0 <input.fbx> [output.glb]"
    echo "Example: $0 model.fbx model.glb"
    exit 1
fi

INPUT="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
OUTPUT="${2:-${INPUT%.fbx}.glb}"

if [ ! -f "$INPUT" ]; then
    echo "Error: Input file '$INPUT' not found"
    exit 1
fi

echo "Converting $(basename "$INPUT") -> $(basename "$OUTPUT")"

# Create temporary Python script
TEMP_SCRIPT=$(mktemp /tmp/blender_convert.XXXXXX.py)

cat > "$TEMP_SCRIPT" <<EOF
import bpy
import sys

# Clear default scene
bpy.ops.wm.read_factory_settings(use_empty=True)

# Import FBX
print(f"Importing FBX: $INPUT")
bpy.ops.import_scene.fbx(filepath="$INPUT")

# Export as glTF
print(f"Exporting glTF: $OUTPUT")
bpy.ops.export_scene.gltf(
    filepath="$OUTPUT",
    export_format='GLB',
    export_texcoords=True,
    export_normals=True,
    export_materials='EXPORT',
    export_colors=True,
    export_cameras=False,
    export_lights=False
)

print("Conversion complete!")
EOF

blender --background --python "$TEMP_SCRIPT"
EXIT_CODE=$?

rm "$TEMP_SCRIPT"

if [ $EXIT_CODE -eq 0 ] && [ -f "$OUTPUT" ]; then
    echo "✓ Success! Output: $OUTPUT"
    exit 0
else
    echo "✗ Conversion failed"
    exit 1
fi
