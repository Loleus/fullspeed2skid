export function updateSkidMarks(scene, tileSize, pairs = []) {
    const dirtyTiles = new Set();

    for (const { controller, skidMarks } of pairs) {
        const steerAngle = controller.getSteerAngle();
        const carMass = controller.carMass;
        const maxSpeed = controller.maxSpeed;
        const localSpeed = controller.getLocalSpeed();
        const throttle = controller.getThrottle?.() ?? 0;

        for (let i = 0; i < 4; i++) {
        const slip = controller.getWheelSlip(i);
        const curr = controller.getWheelWorldPosition(i);
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

        const wheelDirtyTiles = skidMarks.update(
            i,
            curr,
            slip,
            steerAngle,
            scene.world.tilePool,
            tileSize,
            localSpeed,
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
    }

    dirtyTiles.forEach((tile) => tile.texture.refresh());
}
