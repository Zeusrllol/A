import { DatabaseManager } from "@alice-database/DatabaseManager";
import { UserBindCollectionManager } from "@alice-database/managers/elainaDb/UserBindCollectionManager";
import { UserBind } from "@alice-database/utils/elainaDb/UserBind";
import { Subcommand } from "@alice-interfaces/core/Subcommand";
import { MessageCreator } from "@alice-utils/creators/MessageCreator";
import { DPPHelper } from "@alice-utils/helpers/DPPHelper";
import { Collection, Snowflake } from "discord.js";
import { scanStrings } from "../scanStrings";

export const run: Subcommand["run"] = async (client, interaction) => {
    const dbManager: UserBindCollectionManager = DatabaseManager.elainaDb.collections.userBind;

    let calculatedCount: number = 0;

    await interaction.editReply({
        content: MessageCreator.createAccept(scanStrings.scanStarted)
    });

    while (true) {
        const players: Collection<Snowflake, UserBind> = await dbManager.getDPPUnscannedPlayers(50);

        if (players.size === 0) {
            break;
        }

        for await (const player of players.values()) {
            client.logger.info(`Now calculating ID ${player.discordid}`);

            await player.scanDPP();

            const finalPP: number = DPPHelper.calculateFinalPerformancePoints(player.pp);

            client.logger.info(`Final pp: ${finalPP}`);
            client.logger.info(`${++calculatedCount} players scanned`);
        }
    }

    await dbManager.update({}, { $unset: { dppScanComplete: "" } });

    interaction.channel!.send({
        content: MessageCreator.createAccept(scanStrings.scanComplete, interaction.user.toString())
    });
};

export const config: Subcommand["config"] = {
    permissions: ["BOT_OWNER"]
};