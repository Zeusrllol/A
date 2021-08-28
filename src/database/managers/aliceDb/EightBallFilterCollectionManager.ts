import { Bot } from "@alice-core/Bot";
import { DatabaseCollectionManager } from "@alice-database/managers/DatabaseCollectionManager";
import { EightBallFilter } from "@alice-database/utils/aliceDb/EightBallFilter";
import { DatabaseEightBallFilter } from "@alice-interfaces/database/aliceDb/DatabaseEightBallFilter";
import { DatabaseUtilityConstructor } from "@alice-types/database/DatabaseUtilityConstructor";
import { Collection as MongoDBCollection } from "mongodb";

/**
 * A manager for the `responsefilter` collection.
 */
export class EightBallFilterCollectionManager extends DatabaseCollectionManager<DatabaseEightBallFilter, EightBallFilter> {
    protected readonly utilityInstance: DatabaseUtilityConstructor<DatabaseEightBallFilter, EightBallFilter>;

    get defaultDocument(): DatabaseEightBallFilter {
        return {
            badwords: [],
            hate: [],
            like: [],
            name: "",
            response: []
        };
    }

    constructor(client: Bot, collection: MongoDBCollection<DatabaseEightBallFilter>) {
        super(
            client,
            collection
        );

        this.utilityInstance = <DatabaseUtilityConstructor<DatabaseEightBallFilter, EightBallFilter>> new EightBallFilter(client, this.defaultDocument).constructor
    }
}