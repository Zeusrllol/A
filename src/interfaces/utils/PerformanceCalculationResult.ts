import { DroidPerformanceCalculator, MapInfo, OsuPerformanceCalculator, ReplayAnalyzer } from "osu-droid";

/**
 * Represents a beatmap's performance calculation result.
 */
export interface PerformanceCalculationResult {
    /**
     * The beatmap being calculated.
     */
    readonly map: MapInfo,

    /**
     * The replay of the score, if a score is calculated and the replay for that score is available.
     */
    readonly replay?: ReplayAnalyzer,

    /**
     * The performance of the beatmap in osu!droid.
     */
    readonly droid: DroidPerformanceCalculator,

    /**
     * The performance of the beatmap in osu!standard.
     */
    readonly osu: OsuPerformanceCalculator
};