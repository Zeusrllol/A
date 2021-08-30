import { Constants } from "@alice-core/Constants";
import { DatabaseManager } from "@alice-database/DatabaseManager";
import { UserBindCollectionManager } from "@alice-database/managers/elainaDb/UserBindCollectionManager";
import { UserBind } from "@alice-database/utils/elainaDb/UserBind";
import { CommandArgumentType } from "@alice-enums/core/CommandArgumentType";
import { CommandCategory } from "@alice-enums/core/CommandCategory";
import { Command } from "@alice-interfaces/core/Command";
import { EmbedCreator } from "@alice-utils/creators/EmbedCreator";
import { MessageCreator } from "@alice-utils/creators/MessageCreator";
import { BeatmapManager } from "@alice-utils/managers/BeatmapManager";
import { GuildMember, MessageEmbed, Snowflake } from "discord.js";
import { Player, Score } from "osu-droid";
import { compareStrings } from "./compareStrings";

export const run: Command["run"] = async (_, interaction) => {
    if (interaction.options.data.length > 1) {
        return interaction.editReply({
            content: MessageCreator.createReject(compareStrings.tooManyOptions)
        });
    }

    const cachedBeatmapHash: string | undefined = BeatmapManager.getChannelLatestBeatmap(interaction.channel!.id);

    if (!cachedBeatmapHash) {
        return interaction.editReply({
            content: MessageCreator.createReject(compareStrings.noCachedBeatmap)
        });
    }

    const discordid: Snowflake | undefined = interaction.options.getUser("user")?.id;
    let uid: number | undefined | null = interaction.options.getInteger("uid");
    const username: string | null = interaction.options.getString("username");

    const dbManager: UserBindCollectionManager = DatabaseManager.elainaDb.collections.userBind;

    let bindInfo: UserBind | null | undefined;

    let player: Player | undefined;

    switch (true) {
        case !!uid:
            player = await Player.getInformation({ uid: uid! });
            uid = player.uid;
            break;
        case !!username:
            player = await Player.getInformation({ username: username! });
            uid = player.uid;
            break;
        case !!discordid:
            bindInfo = await dbManager.getFromUser(discordid!);

            if (!bindInfo) {
                return interaction.editReply({
                    content: MessageCreator.createReject(Constants.userNotBindedReject)
                });
            }

            player = await Player.getInformation({ uid: bindInfo.uid });
            break;
        default:
            // If no arguments are specified, default to self
            bindInfo = await dbManager.getFromUser(interaction.user);

            if (!bindInfo) {
                return interaction.editReply({
                    content: MessageCreator.createReject(Constants.selfNotBindedReject)
                });
            }

            player = await Player.getInformation({ uid: bindInfo.uid });
    }

    if (!player.username) {
        return interaction.editReply({
            content: MessageCreator.createReject(compareStrings.playerNotFound)
        });
    }

    const score: Score = await Score.getFromHash({ uid: player.uid, hash: cachedBeatmapHash });

    if (!score.title) {
        return interaction.editReply({
            content: MessageCreator.createReject(
                compareStrings.scoreNotFound,
                !!uid || !!discordid || !!username ? "this user has" : "you have"
            )
        });
    }

    const embed: MessageEmbed = await EmbedCreator.createRecentPlayEmbed(
        score,
        player.avatarURL,
        (<GuildMember | null> interaction.member)?.displayColor
    );

    interaction.editReply({
        content: MessageCreator.createAccept(compareStrings.comparePlayDisplay, player.username),
        embeds: [ embed ]
    });
};

export const category: Command["category"] = CommandCategory.OSU;

export const config: Command["config"] = {
    name: "compare",
    description: "Compares yours or a player's score among others.",
    options: [
        {
            name: "user",
            type: CommandArgumentType.USER,
            description: "The Discord user to compare."
        },
        {
            name: "uid",
            type: CommandArgumentType.INTEGER,
            description: "The uid of the player."
        },
        {
            name: "username",
            type: CommandArgumentType.STRING,
            description: "The username of the player."
        }
    ],
    example: [
        {
            command: "compare",
            description: "will compare your score among others."
        },
        {
            command: "compare uid:51076",
            description: "will compare the score of an osu!droid account with uid 51076."
        },
        {
            command: "compare username:NeroYuki",
            description: "will compare the score of an osu!droid account with username NeroYuki."
        },
        {
            command: "compare user:@Rian8337#0001",
            description: "will compare the score of Rian8337."
        }
    ],
    permissions: [],
    scope: "ALL"
};