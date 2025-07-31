export function updateSkidMarks(scene, tileSize, skidMarks, throttle) {
    const steerAngle = scene.carController.getSteerAngle();
    const carMass = scene.carController.carMass;
    const dirtyTiles = new Set();

    for (let i = 0; i < 4; i++) {
        const slip = scene.carController.getWheelSlip(i);
        const curr = scene.carController.getWheelWorldPosition(i);
        const surfaceType = scene.world.getSurfaceTypeAt(curr.x, curr.y);

        let grip = 1.0;
        const surfaceParams = scene.world.worldData.surfaceParams;
        if (
            surfaceParams &&
            surfaceParams[surfaceType] &&
            typeof surfaceParams[surfaceType].grip === "number"
        ) {
            grip = surfaceParams[surfaceType].grip;
        }

        const maxSpeed = scene.carController.maxSpeed;
        const wheelDirtyTiles = skidMarks.update(
            i,
            curr,
            slip,
            steerAngle,
            scene.world.tilePool,
            tileSize,
            scene.carController.getLocalSpeed(),
            grip,
            carMass,
            throttle,
            maxSpeed
        );

        wheelDirtyTiles?.forEach((tile) => {
            if (tile?.texture) {
                dirtyTiles.add(tile);
            }
        });
    }

    dirtyTiles.forEach((tile) => tile.texture.refresh());
}
