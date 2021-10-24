import { movementType } from "../../constants/movementType";
import { CursorOccurrence } from "./CursorOccurrence";

/**
 * Contains information about a cursor instance.
 */
export interface CursorInformation {
    /**
     * The movement size of the cursor instance.
     */
    size: number;

    /**
     * The time during which this cursor instance is active in milliseconds.
     */
    time: number[];

    /**
     * The x coordinates of this cursor instance in osu!pixels.
     */
    x: number[];

    /**
     * The y coordinates of this cursor instance in osu!pixels.
     */
    y: number[];

    /**
     * The hit results of this cursor instance.
     */
    id: movementType[];
}

/**
 * Represents a cursor instance in an osu!droid replay.
 * 
 * Stores cursor movement data such as x and y coordinates, movement size, etc.
 * 
 * This is used when analyzing replays using replay analyzer.
 */
export class CursorData {
    /**
     * The movement size of this cursor instance.
     */
    size: number;

    /**
     * The occurrences of this cursor instance.
     */
    readonly occurrences: CursorOccurrence[];

    constructor(values: CursorInformation) {
        this.size = values.size;

        const occurrences: CursorOccurrence[] = [];

        for (let i = 0; i < this.size; ++i) {
            occurrences.push(new CursorOccurrence(
                values.time[i],
                values.x[i],
                values.y[i],
                values.id[i]
            ));
        }

        this.occurrences = occurrences;
    }
}