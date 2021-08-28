import { ObjectId } from "bson";
import { Collection, Guild, GuildChannel, GuildMember, Message, MessageAttachment, Role, Snowflake, TextChannel, User } from "discord.js";
import { Bot } from "@alice-core/Bot";
import { DatabaseManager } from "@alice-database/DatabaseManager";
import { ClanMember } from "@alice-interfaces/clan/ClanMember";
import { ClanOperationResult } from "@alice-interfaces/clan/ClanOperationResult";
import { Powerup } from "@alice-interfaces/clan/Powerup";
import { DatabaseClan } from "@alice-interfaces/database/elainaDb/DatabaseClan";
import { Manager } from "../../../utils/base/Manager";
import { MessageCreator } from "../../../utils/creators/MessageCreator";
import { ArrayHelper } from "@alice-utils/helpers/ArrayHelper";
import { DatabaseOperationResult } from "@alice-interfaces/database/DatabaseOperationResult";
import { Constants } from "@alice-core/Constants";
import { PowerupType } from "@alice-types/clan/PowerupType";
import { RESTManager } from "@alice-utils/managers/RESTManager";
import { Image } from "canvas";
import { Precision } from "osu-droid";

/**
 * Represents a clan.
 */
export class Clan extends Manager {
    /**
     * The BSON object ID of this document in the database.
     */
    readonly _id?: ObjectId;

    /**
     * The name of the clan.
     */
    name: string;

    /**
     * The power of the clan.
     */
    power: number;

    /**
     * The epoch time at which the clan was created.
     */
    createdAt: number;

    /**
     * The Discord ID of the clan leader.
     */
    leader: Snowflake;

    /**
     * The clan's description.
     */
    description: string;

    /**
     * The ID of the message that contains the icon of the clan.
     */
    iconMessage: Snowflake;

    /**
     * The URL of the clan's icon.
     */
    iconURL: string;

    /**
     * The ID of the message that contains the banner of the clan.
     */
    bannerMessage: Snowflake;

    /**
     * The URL of the clan's banner.
     */
    bannerURL: string;

    /**
     * The epoch time at which the clan can change their icon again, in seconds.
     */
    iconcooldown: number;

    /**
     * The epoch time at which the clan can change their banner again, in seconds.
     */
    bannercooldown: number;

    /**
     * The epoch time at which the clan can change their name again, in seconds.
     */
    namecooldown: number;

    /**
     * The epoch time at which the weekly upkeep of the clan will be taken, in seconds.
     */
    weeklyfee: number;

    /**
     * Whether the clan is currently in match mode.
     */
    isMatch: boolean;

    /**
     * The powerups that the clan own, mapped by their name.
     */
    powerups: Collection<PowerupType, Powerup>;

    /**
     * The active powerups of the clan.
     */
    active_powerups: PowerupType[];

    /**
     * The members of the clan, mapped by their ID.
     */
    member_list: Collection<Snowflake, ClanMember>;

    /**
     * Whether the clan exists.
     */
    exists: boolean = true;

    /**
     * The base upkeep value of a clan.
     */
    readonly upkeepBaseValue: number = 200;

    /**
     * The base upkeep value of a clan member.
     */
    get individualUpkeepBaseValue(): number {
        return Math.floor(this.upkeepBaseValue / this.member_list.size);
    }

    private readonly attachmentChannelId: Snowflake = "878541544817307668";

    /**
     * @param data The clan data from database.
     */
    constructor(client: Bot, data: DatabaseClan) {
        super(client);

        this._id = data._id;
        this.name = data.name;
        this.power = data.power;
        this.createdAt = data.createdAt;
        this.leader = data.leader;
        this.description = data.description;
        this.iconMessage = data.iconMessage;
        this.iconURL = data.iconURL;
        this.bannerMessage = data.bannerMessage;
        this.bannerURL = data.bannerURL;
        this.iconcooldown = data.iconcooldown;
        this.bannercooldown = data.bannercooldown;
        this.namecooldown = data.namecooldown;
        this.weeklyfee = data.weeklyfee;
        this.isMatch = data.isMatch;
        this.powerups = ArrayHelper.arrayToCollection(data.powerups ?? [], "name");
        this.active_powerups = data.active_powerups ?? [];
        this.member_list = ArrayHelper.arrayToCollection(data.member_list ?? [], "id");
    }

    /**
     * Notifies the clan leader of a clan.
     * 
     * @param message The message for the clan leader.
     * @returns An object containing information about the operation.
     */
    notifyLeader(message: string): Promise<ClanOperationResult> {
        return new Promise(async resolve => {
            const leader: User = await this.client.users.fetch(this.leader);

            if (!leader) {
                return resolve(this.createOperationResult(false, "clan leader not found"));
            }

            leader.send(MessageCreator.createWarn(message)).then(() => {
                resolve(this.createOperationResult(true));
            }).catch((e: Error) => {
                resolve(this.createOperationResult(false, e.message));
            });
        });
    }

    /**
     * Removes a member from the clan.
     * 
     * If the user is the leader of the clan, a random member will be promoted to leader,
     * with co-leaders being the priority in mind.
     * 
     * If the user is the only member in the clan, the clan will be disbanded. This can
     * be checked by using the `exists` field.
     * 
     * @param user The user to remove.
     * @returns An object containing information about the operation.
     */
    async removeMember(user: User): Promise<ClanOperationResult>;

    /**
     * Removes a member from the clan.
     * 
     * If the user is the leader of the clan, a random member will be promoted to leader,
     * with co-leaders being the priority in mind.
     * 
     * If the user is the only member in the clan, the clan will be disbanded. This can
     * be checked by using the `exists` field.
     * 
     * @param userID The ID of the user to remove.
     * @returns An object containing information about the operation.
     */
    async removeMember(userID: Snowflake): Promise<ClanOperationResult>;

    async removeMember(userOrId: User | Snowflake): Promise<ClanOperationResult> {
        const id: Snowflake = userOrId instanceof User ? userOrId.id : userOrId;

        if (!this.member_list.delete(id)) {
            return this.createOperationResult(false, "user is not in the clan");
        }

        if (this.member_list.size === 0) {
            return this.disband();
        }

        if (id === this.leader) {
            this.changeLeader();
        }

        await this.removeClanRole(userOrId);

        return DatabaseManager.elainaDb.collections.userBind.update(
            { discordid: id },
            {
                $set: {
                    clan: "",
                    oldclan: this.name,
                    joincooldown: Math.floor(Date.now() / 1000) + 86400 * 3,
                    oldjoincooldown: Math.floor(Date.now() / 1000) + 86400 * 14
                }
            }
        );
    }

    /**
     * Changes the leader of the clan.
     * 
     * @param newLeader The Discord ID of the new leader. If unspecified, a random clan member will be picked.
     * @returns An object containing information about the operation.
     */
    changeLeader(newLeader?: Snowflake): ClanOperationResult {
        if (newLeader === this.leader) {
            return this.createOperationResult(false, "new leader is the same as the old leader");
        }

        if (newLeader) {
            if (!this.member_list.get(newLeader)) {
                return this.createOperationResult(false, "cannot find new leader");
            }

            this.leader = newLeader;

            return this.createOperationResult(true);
        }

        let member: ClanMember = this.member_list.random();

        if (this.member_list.some(c => c.hasPermission)) {
            while (!member.hasPermission || member.id === this.leader) {
                member = this.member_list.random();
            }
        }

        member.hasPermission = true;

        this.leader = member.id;

        this.member_list.set(member.id, member);

        return this.createOperationResult(true);
    }

    /**
     * Checks whether a user is the clan leader.
     * 
     * @param user The user.
     */
    isLeader(user: User): boolean;

    /**
     * Checks whether a user is the clan leader.
     * 
     * @param userId The ID of the user.
     */
    isLeader(userId: Snowflake): boolean;

    isLeader(userOrId: User | Snowflake): boolean {
        return (userOrId instanceof User ? userOrId.id : userOrId) === this.leader;
    }

    /**
     * Checks whether a user is a co-leader.
     * 
     * @param user The user.
     */
    isCoLeader(user: User): boolean;

    /**
     * Checks whether a user is a co-leader.
     * 
     * @param userId The ID of the user.
     */
    isCoLeader(userId: Snowflake): boolean;

    isCoLeader(userOrId: User | Snowflake): boolean {
        return this.member_list.get(userOrId instanceof User ? userOrId.id : userOrId)?.hasPermission ?? false;
    }

    /**
     * Checks whether a user has administrative powers in the clan.
     * 
     * @param user The user.
     */
    hasAdministrativePower(user: User): boolean;

    /**
     * Checks whether a user has administrative powers in the clan.
     * 
     * @param userId The ID of the user.
     */
    hasAdministrativePower(userId: Snowflake): boolean;

    hasAdministrativePower(userOrId: User | Snowflake): boolean {
        return this.isLeader(userOrId instanceof User ? userOrId.id : userOrId) || this.isCoLeader(userOrId instanceof User ? userOrId.id : userOrId);
    }

    /**
     * Disbands the clan.
     * 
     * @param reason The reason for disbanding the clan.
     * @returns An object containing information about the operation.
     */
    async disband(): Promise<ClanOperationResult> {
        const result: DatabaseOperationResult = await DatabaseManager.elainaDb.collections.clan.delete(
            { name: this.name }
        );

        this.exists = !result.success;

        if (this.exists) {
            return result;
        }

        await this.removeClanRole(...this.member_list.keys());

        // Delete clan channel
        const mainServer: Guild = await this.client.guilds.fetch(Constants.mainServer);

        const clanChannel: GuildChannel | undefined = <GuildChannel | undefined> mainServer.channels.cache.find(c => c.name === this.name);

        if (clanChannel) {
            await clanChannel.delete();
        }

        return DatabaseManager.elainaDb.collections.userBind.update(
            { clan: this.name },
            {
                $set: {
                    clan: "",
                    oldclan: this.name,
                    joincooldown: Math.floor(Date.now() / 1000) + 86400 * 3,
                    oldjoincooldown: Math.floor(Date.now() / 1000) + 86400 * 14
                }
            }
        );
    }

    /**
     * Updates the clan in clan database.
     * 
     * This should only be called after changing everything needed
     * as this will perform a database operation.
     * 
     * @returns An object containing information about the operation.
     */
    async updateClan(): Promise<ClanOperationResult> {
        return DatabaseManager.elainaDb.collections.clan.update(
            { name: this.name },
            {
                $set: {
                    power: this.power,
                    createdAt: this.createdAt,
                    leader: this.leader,
                    description: this.description,
                    iconMessage: this.iconMessage,
                    iconURL: this.iconURL,
                    bannerMessage: this.bannerMessage,
                    bannerURL: this.bannerURL,
                    iconcooldown: this.iconcooldown,
                    bannercooldown: this.bannercooldown,
                    namecooldown: this.namecooldown,
                    weeklyfee: this.weeklyfee,
                    isMatch: this.isMatch,
                    powerups: [...this.powerups.values()],
                    active_powerups: this.active_powerups,
                    member_list: [...this.member_list.values()]
                }
            }
        );
    }

    /**
     * Sets the clan's match mode.
     * 
     * @param matchMode Whether the clan is in match mode.
     * @returns An object containing information about the operation.
     */
    setMatchMode(matchMode: boolean): ClanOperationResult {
        if (this.isMatch === matchMode) {
            return this.createOperationResult(false, `clan is already${matchMode ? "" : " not"} in match mode`);
        }

        this.isMatch = matchMode;

        return this.createOperationResult(true);
    }

    /**
     * Adds clan roles to users.
     * 
     * @param users The users to add clan roles to.
     */
    async addClanRole(...users: (User | Snowflake)[]): Promise<ClanOperationResult> {
        const clanRole: Role | undefined = await this.getClanRole();

        if (!clanRole) {
            return this.createOperationResult(false, "clan role doesn't exist");
        }

        const mainServer: Guild = await this.client.guilds.fetch(Constants.mainServer);

        const globalClanRole: Role = await this.getGlobalClanRole();

        for await (const user of users) {
            const member: GuildMember | void = await mainServer.members.fetch(user).catch(() => {});

            if (!member) {
                continue;
            }

            await member.roles.add([clanRole, globalClanRole]);
        }

        return this.createOperationResult(true);
    }

    /**
     * Removes clan roles from users.
     * 
     * @param users The users to remove clan roles from.
     */
    async removeClanRole(...users: (User | Snowflake)[]): Promise<ClanOperationResult> {
        const clanRole: Role | undefined = await this.getClanRole();

        if (!clanRole) {
            return this.createOperationResult(false, "clan role doesn't exist");
        }

        const mainServer: Guild = await this.client.guilds.fetch(Constants.mainServer);

        const globalClanRole: Role = await this.getGlobalClanRole();

        for await (const user of users) {
            const member: GuildMember | void = await mainServer.members.fetch(user).catch(() => {});

            if (!member) {
                continue;
            }

            await member.roles.remove([clanRole, globalClanRole]);
        }

        return this.createOperationResult(true);
    }

    /**
     * Gets the clan role of this clan, if any.
     */
    async getClanRole(): Promise<Role | undefined> {
        const mainServer: Guild = await this.client.guilds.fetch(Constants.mainServer);

        return mainServer.roles.cache.find(r => r.name === this.name);
    }

    /**
     * Gets the global clan role.
     */
    async getGlobalClanRole(): Promise<Role> {
        const mainServer: Guild = await this.client.guilds.fetch(Constants.mainServer);

        return mainServer.roles.cache.find(r => r.name === "Clans")!;
    }

    /**
     * Gets the clan channel of this clan, if any.
     */
    async getClanChannel(): Promise<TextChannel | undefined> {
        const mainServer: Guild = await this.client.guilds.fetch(Constants.mainServer);

        return <TextChannel | undefined> mainServer.channels.cache.find(c => c.name === this.name);
    }

    /**
     * Calculates the upkeep of a clan member.
     * 
     * @param user The user.
     */
    calculateUpkeep(user: User): number;

    /**
     * Calculates the upkeep of a clan member.
     * 
     * @param userId The ID of the user.
     */
    calculateUpkeep(userId: Snowflake): number;

    calculateUpkeep(userOrId: User | Snowflake): number {
        const id: Snowflake = userOrId instanceof User ? userOrId.id : userOrId;

        const member: ClanMember | undefined = this.member_list.get(id);

        if (!member) {
            return 0;
        }

        return 500 - Math.floor(34.74 * Math.log(member.rank));
    }

    /**
     * Calculates the overall upkeep of this clan.
     */
    calculateOverallUpkeep(): number {
        const distribution: number[] = this.getEqualUpkeepDistribution();

        return this.upkeepBaseValue +
            this.member_list.reduce((a, v) => a + this.calculateUpkeep(v.id), 0) +
            distribution.reduce((a, v) => a + v, 0);
    }

    /**
     * Gets the equal upkeep distribution of this clan.
     */
    getEqualUpkeepDistribution(): number[] {
        const memberCount: number = this.member_list.size;

        const distributionList: number[] = [];
        const indexList: number[] = [];
        const mod = this.upkeepBaseValue % memberCount;

        for (let i = 0; i < memberCount; ++i) {
            distributionList.push(this.individualUpkeepBaseValue);
        }

        for (let i = 0; i < mod; ++i) {
            let index = Math.floor(Math.random() * distributionList.length);

            while (indexList.includes(index)) {
                index = Math.floor(Math.random() * distributionList.length);
            }

            indexList.push(index);

            ++distributionList[index];
        }

        return distributionList;
    }

    /**
     * Sets the clan's icon.
     * 
     * @param iconURL The URL of the icon. Omit this parameter to delete the current icon.
     */
    async setIcon(iconURL?: string): Promise<ClanOperationResult> {
        const channel: TextChannel = await this.getAttachmentChannel();

        if (iconURL) {
            if (!await RESTManager.downloadImage(iconURL)) {
                return this.createOperationResult(false, "invalid image");
            }

            const attachment: MessageAttachment = new MessageAttachment(iconURL, "icon.png");

            const message: Message = await channel.send({
                content:
                    `Type: Icon\n` +
                    `Clan: ${this.name}`,
                files: [ attachment ]
            });

            this.iconMessage = message.id;
            this.iconURL = message.attachments.first()!.url;
        } else {
            const message: Message = await channel.messages.fetch(this.iconMessage);

            await message.delete();

            this.iconMessage = "";
            this.iconURL = "";
        }

        return this.createOperationResult(true);
    }

    /**
     * Sets the clan's banner.
     * 
     * @param bannerURL The URL of the banner. Omit this parameter to delete the current banner.
     */
    async setBanner(bannerURL?: string): Promise<ClanOperationResult> {
        const channel: TextChannel = await this.getAttachmentChannel();

        if (bannerURL) {
            const image: Image | null = await RESTManager.downloadImage(bannerURL);

            if (!image) {
                return this.createOperationResult(false, "invalid image");
            }

            if (!Precision.almostEqualsNumber(image.naturalWidth / image.naturalHeight, 3.6)) {
                return this.createOperationResult(false, "image ratio is not 18:5");
            }

            const attachment: MessageAttachment = new MessageAttachment(bannerURL, "banner.png");

            const message: Message = await channel.send({
                content:
                    `Type: Banner\n` +
                    `Clan: ${this.name}`,
                files: [ attachment ]
            });

            this.bannerMessage = message.id;
            this.bannerURL = message.attachments.first()!.url;
        } else {
            const message: Message = await channel.messages.fetch(this.bannerMessage);

            await message.delete();

            this.bannerMessage = "";
            this.bannerURL = "";
        }

        return this.createOperationResult(true);
    }

    /**
     * Sets the clan's description.
     * 
     * @param description The clan's new description. Omit this parameter to clear the current description.
     */
    setDescription(description?: string): ClanOperationResult {
        if (description) {
            if (description.length >= 2000) {
                return this.createOperationResult(false, "description must be less than 2000 characters");
            }

            this.description = description;
        } else {
            this.description = "";
        }

        return this.createOperationResult(true);
    }

    /**
     * Increments the clan's power by the specified amount.
     * 
     * @param amount The amount to increment the clan power for.
     */
    incrementPower(amount: number): ClanOperationResult {
        if (this.power + amount < 0) {
            return this.createOperationResult(false, "clan power will fall below zero");
        }

        if (!Number.isFinite(this.power + amount)) {
            return this.createOperationResult(false, "clan power will be infinite");
        }

        this.power += amount;

        return this.createOperationResult(true);
    }

    /**
     * Gets the channel that contains attachments of clan icons and banners.
     */
    private async getAttachmentChannel(): Promise<TextChannel> {
        const channel: TextChannel = <TextChannel> await this.client.channels.fetch(this.attachmentChannelId);

        return channel;
    }
}