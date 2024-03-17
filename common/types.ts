import type { Interaction, SlashCommandBuilder } from "discord.js";

export type Command = {
	data: Partial<SlashCommandBuilder>;
	execute(interaction: Interaction): Promise<unknown>;
	dev?: boolean;
};

export enum Language {
	Subbed = "Subbed",
	Dubbed = "Dubbed",
	Chinese = "Chinese",
}

export enum ButtonAction {
	Subscribe = "button::subscribe",
	Unsubscribe = "button::unsubscribe",
	ShowSubscribeModal = "button::showSubscribeModal",
	SubscriptionListChangePage = "button::subscriptionListChangePage",
}

export enum ModalAction {
	Subscribe = "modal::subscribe",
	Unsubscribe = "modal::unsubscribe",
}

export enum SelectAction {
	Subscribe = "select::subscribe",
	Unsubscribe = "select::unsubscribe",
	UnsubscribeFromSubscriptions = "select::unsubscribeFromSubscriptions",
}

export enum Colors {
	Success = 0x00ff00,
	Error = 0xff0000,
	Warning = 0xffc01a,
	Info = 0x4569cc,
	Accent = 0xffc01a,
}

export type ButtonActionFormat = `${ButtonAction}+${string}`;
