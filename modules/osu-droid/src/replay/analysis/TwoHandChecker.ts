import { Vector2 } from "../../mathutil/Vector2";
import { DifficultyHitObject } from "../../difficulty/preprocessing/DifficultyHitObject";
import { Spinner } from "../../beatmap/hitobjects/Spinner";
import { hitResult } from "../../constants/hitResult";
import { modes } from "../../constants/modes";
import { movementType } from "../../constants/movementType";
import { DroidStarRating } from "../../difficulty/DroidStarRating";
import { DroidHitWindow } from "../../utils/HitWindow";
import { MapStats } from "../../utils/MapStats";
import { CursorData } from "./../data/CursorData";
import { ReplayData } from "./../data/ReplayData";
import { ReplayObjectData } from "./../data/ReplayObjectData";
import { IndexedHitObject } from "./objects/IndexedHitObject";
import { Beatmap } from "../../beatmap/Beatmap";
import { Utils } from "../../utils/Utils";
import { ModUtil } from "../../utils/ModUtil";
import { ModPrecise } from "../../mods/ModPrecise";
import { MathUtils } from "../../mathutil/MathUtils";
import { CursorOccurrence } from "../data/CursorOccurrence";
import { Slider } from "../../beatmap/hitobjects/Slider";

interface CursorInformation {
    readonly cursorIndex: number;
    readonly distanceDiff: number;
}

/**
 * Utility to check whether or not a beatmap is two-handed.
 */
export class TwoHandChecker {
    /**
     * The beatmap that is being analyzed.
     */
    readonly map: DroidStarRating;

    /**
     * The data of the replay.
     */
    readonly data: ReplayData;

    /**
     * The hitobjects of the beatmap that have been assigned with their respective cursor index.
     */
    private readonly indexedHitObjects: IndexedHitObject[] = [];

    /**
     * The osu!droid hitwindow of the analyzed beatmap.
     */
    private readonly hitWindow: DroidHitWindow;

    /**
     * The minimum count of a cursor index occurrence to be valid.
     * 
     * This is used to prevent excessive penalty by splitting the beatmap into
     * those that do not worth any strain.
     */
    private readonly minCursorIndexCount: number = 5;

    /**
     * @param map The beatmap to analyze.
     * @param data The data of the replay.
     */
    constructor(map: DroidStarRating, data: ReplayData) {
        this.map = map;
        this.data = data;

        const stats: MapStats = new MapStats({od: this.map.map.od, mods: this.map.mods.filter(m => !ModUtil.speedChangingMods.map(v => v.droidString).includes(m.droidString))}).calculate();

        this.hitWindow = new DroidHitWindow(stats.od!);
    }

    /**
     * Checks if a beatmap is two-handed.
     */
    check(): boolean {
        if (this.data.cursorMovement.filter(v => v.size > 0).length <= 1) {
            return false;
        }

        this.indexHitObjects();
        this.applyPenalty();

        return true;
    }

    /**
     * Converts hitobjects into indexed hit objects.
     */
    private indexHitObjects(): void {
        const objects: DifficultyHitObject[] = this.map.objects;
        const objectData: ReplayObjectData[] = this.data.hitObjectData;
        const hitWindowOffset: number = this.getHitWindowOffset();
        const indexes: number[] = [];

        for (let i = 0; i < this.map.objects.length; ++i) {
            const current: DifficultyHitObject = objects[i];
            const currentData: ReplayObjectData = objectData[i];
            const index: number = this.getCursorIndex(current, currentData, hitWindowOffset);

            indexes.push(index);
            this.indexedHitObjects.push(new IndexedHitObject(current, index));
        }

        const notFound = this.indexedHitObjects.filter(v => v.cursorIndex === -1);

        console.log("Spinners:", this.map.map.spinners);
        console.log("Misses:", this.data.accuracy.nmiss);
        console.log(indexes.filter(v => v !== -1).length, "cursors found,", indexes.filter(v => v === -1).length, "not found");

        const indexCounts: number[] = Utils.initializeArray(this.data.cursorMovement.length, 0);
        for (const index of indexes) {
            if (index === -1) {
                continue;
            }
            ++indexCounts[index];
        }

        const mainCursorIndex = indexCounts.indexOf(Math.max(...indexCounts));
        const ignoredCursorIndexes: number[] = [];
        for (let i = 0; i < indexCounts.length; ++i) {
            if (indexCounts[i] < this.minCursorIndexCount) {
                ignoredCursorIndexes.push(i);
            }
        }

        this.indexedHitObjects.forEach(indexedHitObject => {
            if (indexedHitObject.cursorIndex === -1 || ignoredCursorIndexes.includes(indexedHitObject.cursorIndex)) {
                indexedHitObject.cursorIndex = mainCursorIndex;
            }
        });

        for (let i = 0; i < this.data.cursorMovement.length; ++i) {
            console.log("Index", i, "count:", indexes.filter(v => v === i).length);
        }
    }

    /**
     * Gets the hit window offset to be applied to `getCursorIndex`.
     */
    private getHitWindowOffset(): number {
        const deltaTimes: number[] = [];

        for (let i = 0; i < this.data.cursorMovement.length; ++i) {
            const c: CursorData = this.data.cursorMovement[i];

            for (let j = 0; j < c.size; ++j) {
                if (c.occurrences[j].time < this.map.map.objects[0].startTime - this.hitWindow.hitWindowFor50()) {
                    continue;
                }

                if (c.occurrences[j].id !== movementType.MOVE) {
                    continue;
                }

                const deltaTime: number = (c.occurrences[j]?.time - c.occurrences[j - 1]?.time) || 0;

                if (deltaTime > 0) {
                    deltaTimes.push(deltaTime);
                }
            }
        }

        return Math.min(...deltaTimes);
    }

    /**
     * Gets the cursor index that hits the given object.
     * 
     * @param object The object to check.
     * @param data The replay data of the object.
     * @param hitWindowOffset The offset for hit window to compensate for replay hit inaccuracies.
     * @returns The cursor index that hits the given object, -1 if the index is not found, the object is a spinner, or the object was missed.
     */
    private getCursorIndex(object: DifficultyHitObject, data: ReplayObjectData, hitWindowOffset: number): number {
        if (object.object instanceof Spinner || data.result === hitResult.RESULT_0) {
            return -1;
        }

        const isPrecise: boolean = this.data.convertedMods.some(m => m instanceof ModPrecise);
        const isSlider: boolean = object.object instanceof Slider;

        // For sliders, automatically set hit window to be as lenient as possible.
        let hitWindowLength: number = this.hitWindow.hitWindowFor50(isPrecise);
        if (!isSlider) {
            switch (data.result) {
                case hitResult.RESULT_300:
                    hitWindowLength = this.hitWindow.hitWindowFor300(isPrecise);
                    break;
                case hitResult.RESULT_100:
                    hitWindowLength = this.hitWindow.hitWindowFor100(isPrecise);
                    break;
            }
        }

        const startTime: number = object.object.startTime;
        const hitTime: number = startTime + data.accuracy;
        const minimumHitTime: number = startTime - hitWindowLength - hitWindowOffset;
        const maximumHitTime: number = startTime + hitWindowLength + hitWindowOffset;
        const cursorInformations: CursorInformation[] = [];

        for (let i = 0; i < this.data.cursorMovement.length; ++i) {
            const c: CursorData = this.data.cursorMovement[i];

            if (c.size === 0) {
                continue;
            }

            let hitTimeBeforeIndex: number = MathUtils.clamp(c.occurrences.findIndex(v => v.time >= minimumHitTime), 1, c.size - 1) - 1;
            let hitTimeAfterIndex: number = c.occurrences.findIndex(
                // There is a special case for sliders where the time leniency in droid is a lot bigger compared to PC.
                // To prevent slider end time from ending earlier than hit window leniency, we use the maximum value between both.
                v => v.time >= Math.max(object.object.endTime, maximumHitTime)
            );

            if (hitTimeAfterIndex === -1) {
                // Maximum hit time or object end time may be out of bounds for every presses.
                // We set the index to the latest cursor occurrence if that happens.
                hitTimeAfterIndex = c.size;
            }

            --hitTimeAfterIndex;

            // Sometimes a `movementType.UP` instance occurs at the same time as a `movementType.MOVE`
            // or a cursor is recorded twice in one time, therefore this check is required.
            while (c.occurrences[hitTimeBeforeIndex]?.time === c.occurrences[hitTimeBeforeIndex - 1]?.time && hitTimeBeforeIndex > 0) {
                --hitTimeBeforeIndex;
            }

            // We track the cursor movement along those indexes.
            // Current cursor position is in `hitTimeBeforeIndex`.
            let distance: number = Number.POSITIVE_INFINITY;
            let acceptableRadius: number = object.radius;

            // Sliders have a bigger radius tolerance due to slider ball.
            if (isSlider) {
                acceptableRadius *= 2.4;
            }

            for (let j = hitTimeBeforeIndex; j <= hitTimeAfterIndex; ++j) {
                const occurrence: CursorOccurrence = c.occurrences[j];

                if (occurrence.id === movementType.UP) {
                    continue;
                }

                const cursorPosition = new Vector2(occurrence.position);

                distance = Math.min(distance, object.object.stackedPosition.getDistance(cursorPosition));

                const nextOccurrence: CursorOccurrence = c.occurrences[j + 1];

                if (nextOccurrence && nextOccurrence.id === movementType.MOVE && occurrence.time <= maximumHitTime && occurrence.time !== nextOccurrence.time) {
                    // If next cursor is a `move` instance and it doesn't go out of time
                    // range, we interpolate cursor position between two occurrences.
                    const nextPosition: Vector2 = new Vector2(nextOccurrence.position);

                    const displacement: Vector2 = nextPosition.subtract(cursorPosition);

                    for (let mSecPassed = occurrence.time; mSecPassed <= Math.min(hitTime + hitWindowOffset, nextOccurrence.time); ++mSecPassed) {
                        const progress: number = (mSecPassed - occurrence.time) / (nextOccurrence.time - occurrence.time);

                        distance = Math.min(
                            distance,
                            object.object.stackedPosition.getDistance(cursorPosition.add(displacement.scale(progress)))
                        );
                    }
                }
            }

            if (distance <= acceptableRadius) {
                cursorInformations.push({
                    cursorIndex: i,
                    distanceDiff: distance
                });
            }
        }

        // const isActive: boolean[] = Utils.initializeArray(this.data.cursorMovement.length, false);

        // // Get the list of cursors that are active when object hit window is still active.
        // for (let i = 0; i < this.data.cursorMovement.length; ++i) {
        //     const c: CursorData = this.data.cursorMovement[i];

        //     for (let j = 0; j < c.size; ++j) {
        //         if (c.time[j] > maximumHitTime) {
        //             break;
        //         }

        //         isActive[i] = c.id[j] === movementType.DOWN || c.id[j] === movementType.MOVE;
        //     }
        // }

        // if (isActive.filter(Boolean).length === 1) {
        //     return isActive.indexOf(true);
        // }

        // Now we check the position of each cursor during which the object is hit.
        // for (let i = 0; i < this.data.cursorMovement.length; ++i) {
        //     if (!isActive[i]) {
        //         continue;
        //     }

        //     let distance: number = Number.POSITIVE_INFINITY;

        //     const c: CursorData = this.data.cursorMovement[i];

        //     for (let j = 0; j < c.size; ++j) {
        //         if (c.time[j] < minimumHitTime) {
        //             continue;
        //         }

        //         if (c.time[j] > maximumHitTime) {
        //             break;
        //         }

        //         if (c.id[j] === movementType.UP) {
        //             continue;
        //         }

        //         let hitPosition: Vector2 = new Vector2({
        //             x: c.x[j],
        //             y: c.y[j]
        //         });

        //         distance = object.object.stackedPosition.getDistance(hitPosition);

        //         if (c.id[j + 1] === movementType.MOVE) {
        //             // Interpolate cursor position between two occurrences
        //             const initialPosition: Vector2 = new Vector2({
        //                 x: c.x[j],
        //                 y: c.y[j]
        //             });

        //             const nextPosition: Vector2 = new Vector2({
        //                 x: c.x[j + 1],
        //                 y: c.y[j + 1]
        //             });

        //             const displacement: Vector2 = nextPosition.subtract(initialPosition);

        //             for (let mSecPassed = c.time[j]; mSecPassed <= Math.min(c.time[j + 1], maximumHitTime); ++mSecPassed) {
        //                 const progress: number = (mSecPassed - c.time[j]) / (c.time[j + 1] - c.time[j]);

        //                 hitPosition = initialPosition.add(displacement.scale(progress));
        //                 distance = object.object.stackedPosition.getDistance(hitPosition);
        //             }
        //         }
        //     }

        //     if (distance <= object.radius) {
        //         cursorInformations.push({
        //             cursorIndex: i,
        //             distanceDiff: distance
        //         });
        //     }
        // }
        // for (let i = 0; i < this.data.cursorMovement.length; ++i) {
        //     if (!isActive[i]) {
        //         continue;
        //     }

        //     const c: CursorData = this.data.cursorMovement[i];

        //     let minDistance: number = Number.POSITIVE_INFINITY;
        //     let minHitTime: number = 0;

        //     for (let j = 0; j < c.size; ++j) {
        //         if (c.time[j] < minimumHitTime) {
        //             continue;
        //         }

        //         if (c.time[j - 1] > maximumHitTime) {
        //             break;
        //         }

        //         let hitPosition: Vector2 = new Vector2({
        //             x: c.x[j],
        //             y: c.y[j]
        //         });

        //         let distanceToObject: number = object.object.stackedPosition.getDistance(hitPosition);
        //         if (minDistance > distanceToObject) {
        //             minDistance = distanceToObject;
        //             minHitTime = c.time[j];
        //         }

        //         minDistance = Math.min(minDistance, object.object.stackedPosition.getDistance(hitPosition));

        //         if (c.id[j + 1] === movementType.MOVE || c.id[j] === movementType.MOVE) {
        //             // Interpolate cursor position between two occurrences
        //             const initialPosition: Vector2 = new Vector2({
        //                 x: c.x[j],
        //                 y: c.y[j]
        //             });

        //             const nextPosition: Vector2 = new Vector2({
        //                 x: c.x[j + 1],
        //                 y: c.y[j + 1]
        //             });

        //             const displacement: Vector2 = nextPosition.subtract(initialPosition);

        //             for (let mSecPassed = c.time[j]; mSecPassed <= Math.min(c.time[j + 1], maximumHitTime); ++mSecPassed) {
        //                 const progress: number = (mSecPassed - c.time[j]) / (c.time[j + 1] - c.time[j]);

        //                 hitPosition = initialPosition.add(displacement.scale(progress));
        //                 distanceToObject = object.object.stackedPosition.getDistance(hitPosition);
        //                 if (minDistance > distanceToObject) {
        //                     minDistance = distanceToObject;
        //                     minHitTime = mSecPassed;
        //                 }
        //             }
        //         }
        //     }

        //     if (minDistance <= object.radius) {
        //         cursorInformations.push({
        //             cursorIndex: i,
        //             hitTimeDiff: Math.abs(minHitTime - hitTime)
        //         });
        //     }
        // }

        // Cursors have been filtered to see which of them is inside the object.
        // Now we look at which cursor is closest to the center of the object.
        const minDistanceDiff: number = Math.min(...cursorInformations.map(v => { return v.distanceDiff; }));
        return cursorInformations.find(c => c.distanceDiff === minDistanceDiff)?.cursorIndex ?? -1;
    }

    /**
     * Applies penalty to the original star rating instance.
     */
    private applyPenalty(): void {
        const beatmaps: Beatmap[] = new Array(this.data.cursorMovement.length);

        this.indexedHitObjects.forEach(o => {
            if (!beatmaps[o.cursorIndex]) {
                const map: Beatmap = Utils.deepCopy(this.map.map);

                map.objects.length = 0;

                beatmaps[o.cursorIndex] = map;
            }

            beatmaps[o.cursorIndex].objects.push(o.object.object);
        });

        this.map.objects.length = 0;

        beatmaps.forEach(beatmap => {
            if (!beatmap) {
                return;
            }

            const starRating: DroidStarRating = Utils.deepCopy(this.map);
            starRating.map = beatmap;
            starRating.generateDifficultyHitObjects(modes.droid);
            starRating.objects[0].deltaTime = starRating.objects[0].startTime - this.indexedHitObjects[0].object.startTime;
            starRating.objects[0].strainTime = Math.max(25, starRating.objects[0].deltaTime);
            this.map.objects.push(...starRating.objects);
        });

        this.map.objects.sort((a, b) => {return a.startTime - b.startTime;});
        this.map.calculateAll();
    }
}