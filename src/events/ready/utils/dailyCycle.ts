import { Config } from "@alice-core/Config";
import { DatabaseManager } from "@alice-database/DatabaseManager";
import { PlayerInfo } from "@alice-database/utils/aliceDb/PlayerInfo";
import { EventUtil } from "@alice-interfaces/core/EventUtil";
import { MessageAnalyticsHelper } from "@alice-utils/helpers/MessageAnalyticsHelper";

async function resetDailyCoinsAndMapShare(): Promise<void> {
    await DatabaseManager.aliceDb.collections.playerInfo.update(
        { discordid: "386742340968120321" }, { $inc: { dailyreset: 86400 } }
    );

    // Reset coin streak
    await DatabaseManager.aliceDb.collections.playerInfo.update(
        { hasClaimedDaily: false }, { $set: { streak: 0 } }
    );

    await DatabaseManager.aliceDb.collections.playerInfo.update(
        {}, { $set: { hasClaimedDaily: false, hasSubmittedMapShare: false, transferred: 0 } }
    );
}

export const run: EventUtil["run"] = async () => {
    const playerInfo: PlayerInfo = (await DatabaseManager.aliceDb.collections.playerInfo.getFromUser("386742340968120321"))!;

    let resetTime: number = playerInfo.dailyreset!;

    setInterval(async () => {
        if (Config.maintenance || resetTime > Math.floor(Date.now() / 1000)) {
            return;
        }

        await resetDailyCoinsAndMapShare();
        await MessageAnalyticsHelper.fetchDaily(resetTime * 1000);

        resetTime += 86400;
    }, 15 * 1000);
};

export const config: EventUtil["config"] = {
    description: "Responsible for doing daily activities such as message analytics fetch and coins claim reset.",
    togglePermissions: ["BOT_OWNER"],
    toggleScope: ["GLOBAL"]
};