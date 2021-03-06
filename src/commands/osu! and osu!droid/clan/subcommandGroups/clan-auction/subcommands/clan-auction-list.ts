import { clanStrings } from "@alice-commands/osu! and osu!droid/clan/clanStrings";
import { DatabaseManager } from "@alice-database/DatabaseManager";
import { ClanAuction } from "@alice-database/utils/aliceDb/ClanAuction";
import { Subcommand } from "@alice-interfaces/core/Subcommand";
import { OnButtonPageChange } from "@alice-interfaces/utils/OnButtonPageChange";
import { EmbedCreator } from "@alice-utils/creators/EmbedCreator";
import { MessageButtonCreator } from "@alice-utils/creators/MessageButtonCreator";
import { MessageCreator } from "@alice-utils/creators/MessageCreator";
import { NumberHelper } from "@alice-utils/helpers/NumberHelper";
import { StringHelper } from "@alice-utils/helpers/StringHelper";
import { Collection, GuildMember, MessageEmbed } from "discord.js";

export const run: Subcommand["run"] = async (_, interaction) => {
    const auctions: Collection<string, ClanAuction> = await DatabaseManager.aliceDb.collections.clanAuction.get("name");

    if (auctions.size === 0) {
        return interaction.editReply({
            content: MessageCreator.createReject(clanStrings.noActiveAuctions)
        });
    }

    const page: number = NumberHelper.clamp(interaction.options.getInteger("page") ?? 1, 1, Math.ceil(auctions.size / 5));

    const embed: MessageEmbed = EmbedCreator.createNormalEmbed(
        { author: interaction.user, color: (<GuildMember> interaction.member).displayColor }
    );

    const onPageChange: OnButtonPageChange = async (_, page, contents: ClanAuction[]) => {
        for (let i = 5 * (page - 1); i < Math.min(contents.length, 5 + 5 * (page - 1)); ++i) {
            const auction: ClanAuction = contents[i];

            embed.addField(
                `**${i + 1}. ${auction.name}**`,
                `**Auctioneer**: ${auction.auctioneer}\n` +
                `**Creation Date**: ${new Date(auction.creationdate * 1000).toUTCString()}\n` +
                `**Expiration Date**: ${new Date(auction.expirydate * 1000).toUTCString()}\n\n` +
                `**Powerup**: ${StringHelper.capitalizeString(auction.powerup)}\n` +
                `**Amount**: ${auction.amount.toLocaleString()}\n` +
                `**Minimum Bid Amount**: ${auction.min_price.toLocaleString()} Alice coins\n` +
                `**Bidders**: ${auction.bids.size.toLocaleString()}`
            );
        }
    };

    MessageButtonCreator.createLimitedButtonBasedPaging(
        interaction,
        { embeds: [ embed ] },
        [interaction.user.id],
        [...auctions.values()],
        5,
        page,
        120,
        onPageChange
    );
};

export const config: Subcommand["config"] = {
    permissions: []
};