import { GameRoot } from "../../root";
import { Vector } from "../../../core/vector";
import { Entity } from "../../entity";
import { DrawParameters } from "../../../core/draw_parameters";
import { StaticMapEntityComponent } from "../../components/static_map_entity";
import { createLogger } from "../../../core/logging";
import { Loader } from "../../../core/loader";

const logger = createLogger("blueprint");

export class Blueprint {
    /**
     * @param {Array<Entity>} entities
     */
    constructor(entities) {
        this.entities = entities;
    }

    /**
     * @param {GameRoot} root
     * @param {Array<number>} uids
     */
    static fromUids(root, uids) {
        const newEntities = [];

        let averagePosition = new Vector();

        // First, create a copy
        for (let i = 0; i < uids.length; ++i) {
            const entity = root.entityMgr.findByUid(uids[i]);
            assert(entity, "Entity for blueprint not found:" + uids[i]);

            const clone = entity.duplicateWithoutContents();
            newEntities.push(clone);

            const pos = entity.components.StaticMapEntity.getTileSpaceBounds().getCenter();
            averagePosition.addInplace(pos);
        }

        averagePosition.divideScalarInplace(uids.length);
        const blueprintOrigin = averagePosition.floor();
        for (let i = 0; i < uids.length; ++i) {
            newEntities[i].components.StaticMapEntity.origin.subInplace(blueprintOrigin);
        }

        // Now, make sure the origin is 0,0
        return new Blueprint(newEntities);
    }

    /**
     *
     * @param {DrawParameters} parameters
     */
    draw(parameters, tile) {
        parameters.context.globalAlpha = 0.8;
        for (let i = 0; i < this.entities.length; ++i) {
            const entity = this.entities[i];
            const staticComp = entity.components.StaticMapEntity;
            if (!staticComp.blueprintSpriteKey) {
                logger.warn("Blueprint entity without sprite!");
                return;
            }
            const newPos = staticComp.origin.add(tile);

            const rect = staticComp.getTileSpaceBounds();
            rect.moveBy(tile.x, tile.y);

            let placeable = true;
            placementCheck: for (let x = rect.x; x < rect.right(); ++x) {
                for (let y = rect.y; y < rect.bottom(); ++y) {
                    if (parameters.root.map.isTileUsedXY(x, y)) {
                        placeable = false;
                        break placementCheck;
                    }
                }
            }

            if (!placeable) {
                parameters.context.globalAlpha = 0.3;
            } else {
                parameters.context.globalAlpha = 1;
            }

            staticComp.drawSpriteOnFullEntityBounds(
                parameters,
                Loader.getSprite(staticComp.blueprintSpriteKey),
                0,
                true,
                newPos
            );
        }
        parameters.context.globalAlpha = 1;
    }

    /**
     * @param {GameRoot} root
     * @param {Vector} tile
     */
    canPlace(root, tile) {
        let anyPlaceable = false;

        for (let i = 0; i < this.entities.length; ++i) {
            let placeable = true;
            const entity = this.entities[i];
            const staticComp = entity.components.StaticMapEntity;
            const rect = staticComp.getTileSpaceBounds();
            rect.moveBy(tile.x, tile.y);
            placementCheck: for (let x = rect.x; x < rect.right(); ++x) {
                for (let y = rect.y; y < rect.bottom(); ++y) {
                    if (root.map.isTileUsedXY(x, y)) {
                        placeable = false;
                        break placementCheck;
                    }
                }
            }

            if (placeable) {
                anyPlaceable = true;
            }
        }

        return anyPlaceable;
    }

    /**
     * @param {GameRoot} root
     * @param {Vector} tile
     */
    tryPlace(root, tile) {
        let anyPlaced = false;
        for (let i = 0; i < this.entities.length; ++i) {
            let placeable = true;
            const entity = this.entities[i];
            const staticComp = entity.components.StaticMapEntity;
            const rect = staticComp.getTileSpaceBounds();
            rect.moveBy(tile.x, tile.y);
            placementCheck: for (let x = rect.x; x < rect.right(); ++x) {
                for (let y = rect.y; y < rect.bottom(); ++y) {
                    const contents = root.map.getTileContentXY(x, y);
                    if (contents && !contents.components.ReplaceableMapEntity) {
                        placeable = false;
                        break placementCheck;
                    }
                }
            }

            if (placeable) {
                for (let x = rect.x; x < rect.right(); ++x) {
                    for (let y = rect.y; y < rect.bottom(); ++y) {
                        const contents = root.map.getTileContentXY(x, y);
                        if (contents) {
                            assert(
                                contents.components.ReplaceableMapEntity,
                                "Can not delete entity for blueprint"
                            );
                            if (!root.logic.tryDeleteBuilding(contents)) {
                                logger.error(
                                    "Building has replaceable component but is also unremovable in blueprint"
                                );
                                return false;
                            }
                        }
                    }
                }

                const clone = entity.duplicateWithoutContents();
                clone.components.StaticMapEntity.origin.addInplace(tile);

                root.map.placeStaticEntity(clone);
                root.entityMgr.registerEntity(clone);
                anyPlaced = true;
            }
        }
        return anyPlaced;
    }
}