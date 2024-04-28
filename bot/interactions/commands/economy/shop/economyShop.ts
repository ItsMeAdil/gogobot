import { guardEconomyChannel } from "!/bot/logic/guildConfig/guardEconomyChannel";
import { Colors, InteractionType, type Command } from "!/bot/types";
import {
  ActionRowBuilder,
  EmbedBuilder,
  type Guild,
  type Interaction,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type User,
} from "discord.js";
import { buyToolItems } from "!/bot/interactions/commands/economy/lib/shopItems";
import { sprintf } from "sprintf-js";
import { addCurrency } from "!/bot/utils/addCurrency";
import { formatNumber } from "!/bot/utils/formatNumber";
import { prisma } from "!/core/db/prisma";
import { z } from "zod";
import { createWallet } from "!/bot/logic/economy/createWallet";

export const shopBuyMenuContext = z.object({
  walletId: z.string()
})

export const shop = {
  data: new SlashCommandBuilder()
    .setName("shop")
    .setDescription("Buy or Sell Resources/Tools")
    .addSubcommand((subcommand) =>
      subcommand.setName("buy").setDescription("Buy items from the store!"),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("sell").setDescription("Sell resources gathered"),
    ),
  async execute(interaction: Interaction) {
    if (!interaction.isRepliable() || !interaction.isChatInputCommand()) {
      return;
    }

    const guildId = interaction.guild?.id;

    if (!guildId) {
      return await interaction.reply({
        content: "This command can only be used in a Server.",
        ephemeral: true,
      });
    }

    const guard = await guardEconomyChannel(
      guildId,
      interaction.channelId,
      interaction.user.id,
    );

    if (guard) {
      return await interaction.reply({
        ephemeral: true,
        ...guard,
      });
    }
    const interactionOptions = await formatBuyItems(interaction.user, interaction.guild);
    return await interaction.reply({
      embeds: [interactionOptions.embed],
      components: interactionOptions.component
    });
  },
} satisfies Command;

//Creates the embed for Shop buy
const formatBuyItems = async (user: User, guild: Guild) => {
  const makeDollars = addCurrency();
  const embed = new EmbedBuilder()
    .setTitle(sprintf("%s Shop - Buy", guild.name))
    .setDescription(sprintf("Buy tools from %s's Shop", guild.name))
    .setColor(Colors.Info);

  const tools = Object.entries(buyToolItems);

  embed.addFields([
    {
      name: "Tools",
      value: sprintf(
        "%s",
        tools.map(([_, tool]) =>
          sprintf(
            "%s | %s - %s",
            tool.emoji,
            tool.name,
            makeDollars(formatNumber(tool.price)),
          ),
        ).join("\n"),
      ),
    },
  ]);


  const wallet = await createWallet(user.id, guild.id)
  const shopSelectItemsInteraction = await prisma.interaction.create({
    data: {
      type: InteractionType.ShopBuyToolMenu,
      guildId: guild.id,
      userDiscordId: user.id,
      payload: JSON.stringify({
        walletId: wallet.id
      } satisfies z.infer<typeof shopBuyMenuContext>)
    }
  })

  const firstRow = new ActionRowBuilder<StringSelectMenuBuilder>();

  const stringSelectMenuBuilder = new StringSelectMenuBuilder()
    .setCustomId(shopSelectItemsInteraction.id)
    .setPlaceholder("Select the item you would like to purchase");

    for(const [_, tool] of tools) {
      stringSelectMenuBuilder.addOptions(
        new StringSelectMenuOptionBuilder()
          .setDefault(false)
          .setLabel(tool.name)
          .setEmoji(tool.emoji)
          .setValue(tool.type)
      )
    }

  firstRow.addComponents(
    stringSelectMenuBuilder
  )

  return { embed, component: [firstRow] };
};