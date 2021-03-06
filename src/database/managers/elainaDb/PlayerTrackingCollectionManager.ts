import { PlayerTracking } from "@alice-database/utils/elainaDb/PlayerTracking";
import { DatabasePlayerTracking } from "@alice-interfaces/database/elainaDb/DatabasePlayerTracking";
import { DatabaseCollectionManager } from "../DatabaseCollectionManager";
import { Collection as MongoDBCollection } from "mongodb";
import { DatabaseUtilityConstructor } from "@alice-types/database/DatabaseUtilityConstructor";
import { OperationResult } from "@alice-interfaces/core/OperationResult";

/**
 * A manager for the `tracking` collection.
 */
export class PlayerTrackingCollectionManager extends DatabaseCollectionManager<DatabasePlayerTracking, PlayerTracking> {
    protected override readonly utilityInstance: DatabaseUtilityConstructor<DatabasePlayerTracking, PlayerTracking>;

    override get defaultDocument(): DatabasePlayerTracking {
        return {
            uid: 0
        };
    }

    /**
     * @param collection The MongoDB collection.
     */
    constructor(collection: MongoDBCollection<DatabasePlayerTracking>) {
        super(collection);

        this.utilityInstance = <DatabaseUtilityConstructor<DatabasePlayerTracking, PlayerTracking>> new PlayerTracking().constructor
    }

    /**
     * Adds a player to the tracking list.
     * 
     * @param uid The uid of the player.
     * @returns An object containing information about the operation.
     */
    addPlayer(uid: number): Promise<OperationResult> {
        return this.update({ uid: uid }, { $set: { uid: uid } }, { upsert: true });
    }

    /**
     * Removes a player from the tracking list.
     * 
     * @param uid The uid of the player.
     * @returns An object containing information about the operation.
     */
    removePlayer(uid: number): Promise<OperationResult> {
        return this.delete({ uid: uid });
    }
}