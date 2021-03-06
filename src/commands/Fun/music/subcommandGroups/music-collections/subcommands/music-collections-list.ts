import { musicStrings } from "@alice-commands/Fun/music/musicStrings";
import { DatabaseManager } from "@alice-database/DatabaseManager";
import { MusicCollection } from "@alice-database/utils/aliceDb/MusicCollection";
import { Subcommand } from "@alice-interfaces/core/Subcommand";
import { OnButtonPageChange } from "@alice-interfaces/utils/OnButtonPageChange";
import { EmbedCreator } from "@alice-utils/creators/EmbedCreator";
import { MessageButtonCreator } from "@alice-utils/creators/MessageButtonCreator";
import { MessageCreator } from "@alice-utils/creators/MessageCreator";
import { Collection, GuildMember, MessageEmbed, User } from "discord.js";

export const run: Subcommand["run"] = async (_, interaction) => {
    const user: User = interaction.options.getUser("user") ?? interaction.user;

    const collections: Collection<string, MusicCollection> =
        await DatabaseManager.aliceDb.collections.musicCollection.getUserCollections(user);

    if (collections.size === 0) {
        return interaction.editReply({
            content: MessageCreator.createReject(
                musicStrings.userHasNoCollection, user.id === interaction.user.id ? "you have" : "this user has"
            )
        });
    }

    const embed: MessageEmbed = EmbedCreator.createNormalEmbed(
        { author: user, color: (<GuildMember> interaction.member).displayColor }
    );

    embed.setDescription(`Total collections: ${collections.size}`);

    const onPageChange: OnButtonPageChange = async (_, page, collections: MusicCollection[]) => {
        for (let i = 10 * (page - 1); i < 10 + 10 * (page - 1); ++i) {
            embed.addField(
                `${i + 1}. ${collections[i].name}`,
                `Created at ${new Date(collections[i].createdAt).toUTCString()}`
            );
        }
    };

    MessageButtonCreator.createLimitedButtonBasedPaging(
        interaction,
        { embeds: [ embed ] },
        [interaction.user.id],
        [...collections.values()],
        10,
        1,
        90,
        onPageChange
    );
};

export const config: Subcommand["config"] = {
    permissions: []
};