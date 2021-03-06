import { HitObject } from '../../beatmap/hitobjects/HitObject';
import { Vector2 } from '../../mathutil/Vector2';

/**
 * Represents an osu!standard hit object with difficulty calculation values.
 */
export class DifficultyHitObject {
    /**
     * The underlying hitobject.
     */
    readonly object: HitObject;

    /**
     * The aim strain generated by the hitobject.
     */
    aimStrain: number = 0;

    /**
     * The tap strain generated by the hitobject.
     */
    tapStrain: number = 0;

    /**
     * The tap strain generated by the hitobject if `strainTime` isn't modified by
     * OD. This is used in three-finger detection.
     */
    originalTapStrain: number = 0;

    /**
     * The rhythm multiplier generated by the hitobject.
     */
    rhythmMultiplier: number = 0;

    /**
     * The flashlight strain generated by the hitobject.
     */
    flashlightStrain: number = 0;

    /**
     * The normalized distance between the start and end position of the previous hitobject.
     */
    travelDistance: number = 0;

    /**
     * The normalized distance from the end position of the previous hitobject to the start position of this hitobject.
     */
    jumpDistance: number = 0;

    /**
     * Angle the player has to take to hit this hitobject.
     * 
     * Calculated as the angle between the circles (current-2, current-1, current).
     */
    angle: number | null = null;

    /**
     * The amount of time elapsed between this hitobject and the last hitobject.
     */
    deltaTime: number = 0;

    /**
     * Milliseconds elapsed since the start time of the previous hitobject, with a minimum of 25ms.
     */
    strainTime: number = 0;

    /**
     * Adjusted start time of the hitobject, taking speed multiplier into account.
     */
    startTime: number = 0;

    /**
     * The radius of the hitobject.
     */
    radius: number = 0;

    /**
     * @param object The underlying hitobject.
     */
    constructor(object: HitObject) {
        this.object = object;
    }
}