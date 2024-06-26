import { renderBoard } from "!/bot/logic/c4/renderBoard";
import {
  BinaryColorState,
  Column,
  GameState,
  SlotState,
  boardSchema,
} from "!/bot/logic/c4/types";
import { Colors, InteractionType } from "!/bot/types";
import { addCurrency } from "!/bot/utils/addCurrency";
import { formatNumber } from "!/bot/utils/formatNumber";
import { prisma } from "!/core/db/prisma";
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
} from "discord.js";
import { sprintf } from "sprintf-js";
import { match } from "ts-pattern";
import { z } from "zod";
import type { connect4interactionContext } from "./connect4config";

export async function connect4display(gameId: string) {
  const game = await prisma.connect4Game.findUnique({
    where: {
      id: gameId,
    },
  });

  if (!game) {
    return {
      content: "Game not found. Contact developers.",
    };
  }

  const board = boardSchema.safeParse(JSON.parse(game.board));

  if (!board.success) {
    return {
      content: "Failed to parse board. Contact developers.",
    };
  }

  const embed = new EmbedBuilder();

  embed.setTitle("Connect 4");

  const image = await renderBoard(board.data).catch(() => null);

  if (!image) {
    return {
      content: "Failed to render board. Contact developers.",
    };
  }

  const name = sprintf(
    "c4-%s_vs_%s-date_%s-gid_%s",
    game.challenger,
    game.opponent,
    Date.now().toString(),
    game.id,
  );

  const file = new AttachmentBuilder(image)
    .setName(sprintf("%s.jpeg", name))
    .setDescription("Connect 4 board");

  embed.setImage(sprintf("attachment://%s", file.name));

  if (
    board.data.gameState &&
    game.wagerAmount &&
    [GameState.RedWin, GameState.YellowWin].includes(board.data.gameState)
  ) {
    embed.setFields({
      name: "Prize",
      value: addCurrency()(formatNumber(game.wagerAmount * 2n)),
    });
  }

  if (board.data.forfeitState) {
    embed.setDescription(
      match(board.data.forfeitState)
        .with(BinaryColorState.Red, () =>
          sprintf(
            "<@%s> forfeited, <@%s> wins",
            game.challengerColor === SlotState.Red
              ? game.challenger
              : game.opponent,
            game.challengerColor === SlotState.Red
              ? game.opponent
              : game.challenger,
          ),
        )
        .with(BinaryColorState.Yellow, () =>
          sprintf(
            "<@%s> forfeited, <@%s> wins",
            game.challengerColor === SlotState.Yellow
              ? game.challenger
              : game.opponent,
            game.challengerColor === SlotState.Yellow
              ? game.opponent
              : game.challenger,
          ),
        )
        .exhaustive(),
    );

    embed.setColor(
      match(board.data.forfeitState)
        .with(BinaryColorState.Red, () => 0xffff00)
        .with(BinaryColorState.Yellow, () => 0xff0000)
        .exhaustive(),
    );

    return {
      embeds: [embed],
      content: "",
      components: [],
      files: [file],
    };
  }

  if (board.data.outOfTime) {
    const challengerColor = z
      .nativeEnum(BinaryColorState)
      .parse(game.challengerColor);
    const winner =
      challengerColor === BinaryColorState.Red &&
      game.gameState === GameState.RedWin
        ? "challenger"
        : "opponent";

    embed.setDescription(
      sprintf(
        "%s <@%s> ran out of time.\n%s <@%s> wins!",
        match(board.data.outOfTime)
          .with(BinaryColorState.Red, () => ":yellow_circle:")
          .with(BinaryColorState.Yellow, () => ":red_circle:")
          .run(),
        winner === "challenger" ? game.challenger : game.opponent,
        match(board.data.outOfTime)
          .with(BinaryColorState.Red, () => ":red_circle:")
          .with(BinaryColorState.Yellow, () => ":yellow_circle:")
          .run(),
        winner === "challenger" ? game.opponent : game.challenger,
      ),
    );

    embed.setColor(
      match(board.data.outOfTime)
        .with(BinaryColorState.Red, () => 0xffff00)
        .with(BinaryColorState.Yellow, () => 0xff0000)
        .exhaustive(),
    );

    return {
      embeds: [embed],
      content: "",
      files: [file],
      components: [],
    };
  }

  const challengerColor = z
    .nativeEnum(BinaryColorState)
    .parse(game.challengerColor);

  embed.setDescription(
    [
      sprintf("<@%s> vs <@%s>", game.challenger, game.opponent),
      match(board.data.gameState)
        .with(GameState.RedTurn, () =>
          sprintf(
            "Turn: <@%s> :red_circle: <t:%d:R>",
            game.challengerColor === SlotState.Red
              ? game.challenger
              : game.opponent,
            Math.round(game.lastMoveAt.getTime() / 1000) + game.moveTime,
          ),
        )
        .with(GameState.YellowTurn, () =>
          sprintf(
            "Turn: <@%s> :yellow_circle: <t:%d:R>",
            game.challengerColor === SlotState.Yellow
              ? game.challenger
              : game.opponent,
            Math.round(game.lastMoveAt.getTime() / 1000) + game.moveTime,
          ),
        )
        .with(GameState.RedWin, () =>
          sprintf(
            "Winner: <@%s> :red_circle:",
            challengerColor === BinaryColorState.Red
              ? game.challenger
              : game.opponent,
          ),
        )
        .with(GameState.YellowWin, () =>
          sprintf(
            "Winner: <@%s> :yellow_circle:",
            challengerColor === BinaryColorState.Yellow
              ? game.challenger
              : game.opponent,
          ),
        )
        .otherwise(() => "It's a draw!"),
    ].join("\n"),
  );

  embed.setColor(
    match(board.data.gameState)
      .with(GameState.RedTurn, () => 0xff0000)
      .with(GameState.YellowTurn, () => 0xffff00)
      .with(GameState.RedWin, () => 0xff0000)
      .with(GameState.YellowWin, () => 0xffff00)
      .otherwise(() => Colors.Info),
  );

  const context: z.infer<typeof connect4interactionContext> = {
    gameId,
  };

  const gameEnded = [
    GameState.Draw,
    GameState.RedWin,
    GameState.YellowWin,
  ].includes(board.data.gameState ?? GameState.RedTurn);

  if (gameEnded) {
    return {
      embeds: [embed],
      content: "",
      files: [file],
    };
  }

  const [moveInteraction, forfeitInteraction] = await prisma.$transaction([
    prisma.interaction.create({
      data: {
        guildId: game.guildId,
        channelId: game.channelId,
        type: InteractionType.Connect4Move,
        userDiscordId: game.challenger,
        payload: JSON.stringify(context),
      },
    }),
    prisma.interaction.create({
      data: {
        guildId: game.guildId,
        channelId: game.channelId,
        type: InteractionType.Connect4Forfeit,
        userDiscordId: game.challenger,
        payload: JSON.stringify(context),
      },
    }),
  ]);

  const row1 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setPlaceholder("Make a move")
      .setCustomId(moveInteraction.id)
      .addOptions(
        Object.entries(Column).map(([label, value]) => {
          return {
            label,
            value,
          };
        }),
      ),
  );
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(forfeitInteraction.id)
      .setStyle(ButtonStyle.Danger)
      .setLabel("Forfeit"),
  );

  return {
    embeds: [embed],
    content: "",
    files: [file],
    components: [row1, row2],
  };
}
