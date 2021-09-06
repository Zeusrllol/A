import { Constants } from "@alice-core/Constants";
import { DatabaseManager } from "@alice-database/DatabaseManager";
import { PlayerInfoCollectionManager } from "@alice-database/managers/aliceDb/PlayerInfoCollectionManager";
import { PlayerInfo } from "@alice-database/utils/aliceDb/PlayerInfo";
import { Subcommand } from "@alice-interfaces/core/Subcommand";
import { EmbedCreator } from "@alice-utils/creators/EmbedCreator";
import { ProfileManager } from "@alice-utils/managers/ProfileManager";
import { GuildEmoji, GuildMember, MessageEmbed, Snowflake } from "discord.js";

export const run: Subcommand["run"] = async (client, interaction) => {
    const discordid: Snowflake | undefined = interaction.options.getUser("user")?.id;
    const uid: number | null = interaction.options.getInteger("uid");
    const username: string | null = interaction.options.getString("username");

    const coin: GuildEmoji = client.emojis.resolve(Constants.aliceCoinEmote)!;

    const dbManager: PlayerInfoCollectionManager = DatabaseManager.aliceDb.collections.playerInfo;

    let playerInfo: PlayerInfo | null;

    switch (true) {
        case !!uid:
            playerInfo = await dbManager.getFromUid(uid!);
            break;
        case !!username:
            playerInfo = await dbManager.getFromUsername(username!);
            break;
        case !!discordid:
            playerInfo = await dbManager.getFromUser(discordid!);
            break;
        default:
            // If no arguments are specified, default to self
            playerInfo = await dbManager.getFromUser(interaction.user);
    }

    const embed: MessageEmbed = EmbedCreator.createNormalEmbed(
        { color: (<GuildMember> interaction.member).displayColor }
    );

    embed.setAuthor(`Daily/Weekly Challenge Profile for ${username}`, "https://image.frl/p/beyefgeq5m7tobjg.jpg", playerInfo ? ProfileManager.getProfileLink(playerInfo.uid).toString() : undefined)
        .addField("Statistics", `**Points**: ${playerInfo?.points ?? 0}\n**Alice Coins**: ${coin}${playerInfo?.alicecoins ?? 0}\n**Challenges completed**: ${playerInfo?.challenges.size ?? 0}`);

    interaction.editReply({
        embeds: [ embed ]
    });
};

export const config: Subcommand["config"] = {
    permissions: []
};