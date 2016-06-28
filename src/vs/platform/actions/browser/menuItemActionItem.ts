/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import {localize} from 'vs/nls';
import {IKeybindingService} from 'vs/platform/keybinding/common/keybindingService';
import {IMenu, MenuItemAction} from 'vs/platform/actions/common/actions';
import {IAction} from 'vs/base/common/actions';
import {IDisposable, dispose} from 'vs/base/common/lifecycle';
import {ActionItem, Separator} from 'vs/base/browser/ui/actionbar/actionbar';
import {domEvent} from 'vs/base/browser/event';
import {Emitter} from 'vs/base/common/event';


export function fillInActions(menu: IMenu, target: IAction[] | { primary: IAction[]; secondary: IAction[];}): void {
	const actions = menu.getActions();
	if (actions.length === 0) {
		return;
	}

	for (let tuple of actions) {
		let [group, actions] = tuple;
		if (group === 'navigation') {
			if (Array.isArray<IAction>(target)) {
				target.unshift(...actions);
			} else {
				target.primary.unshift(...actions);
			}
		} else {
			if (Array.isArray<IAction>(target)) {
				target.push(new Separator(), ...actions);
			} else {
				target.secondary.push(new Separator(), ...actions);
			}
		}
	}
}


export function createActionItem(action: IAction, keybindingService: IKeybindingService): ActionItem {
	if (action instanceof MenuItemAction) {
		return new MenuItemActionItem(action, keybindingService);
	}
}


const _altKey = new class extends Emitter<boolean> {

	private _subscriptions: IDisposable[] = [];

	constructor() {
		super({
			onFirstListenerAdd: () => {
				domEvent(document.body, 'keydown')(this._key, this, this._subscriptions);
				domEvent(document.body, 'keyup')(this._key, this, this._subscriptions);
			},
			onLastListenerRemove: () => {
				this._subscriptions = dispose(this._subscriptions);
			}
		});
	}

	private _key(e: KeyboardEvent) {
		this.fire(e.type === 'keydown' && e.altKey);
	}
};

class MenuItemActionItem extends ActionItem {

	private _altKeyDown: boolean = false;

	constructor(
		action: MenuItemAction,
		@IKeybindingService private _keybindingService: IKeybindingService
	) {
		super(undefined, action, { icon: !!action.command.iconClass, label: !action.command.iconClass });
	}

	private get _command() {
		const {command, altCommand} = <MenuItemAction>this._action;
		return this._altKeyDown && altCommand || command;
	}

	onClick(event: MouseEvent): void {
		event.preventDefault();
		event.stopPropagation();

		(<MenuItemAction>this._action).run(this._altKeyDown).done(undefined, console.error);
	}

	render(container: HTMLElement): void {
		super.render(container);

		let altSubscription: IDisposable;
		let mouseOver: boolean;
		this._callOnDispose.push(domEvent(container, 'mouseleave')(_ => {
			if (!this._altKeyDown) {
				dispose(altSubscription);
			}
			mouseOver = false;
		}));
		this._callOnDispose.push(domEvent(container, 'mouseenter')(e => {
			mouseOver = true;
			altSubscription = _altKey.event(value => {
				if (!mouseOver) {
					dispose(altSubscription);
				}
				this._altKeyDown = value;
				this._updateLabel();
				this._updateTooltip();
				this._updateClass();
			});
		}));
	}

	_updateLabel(): void {
		if (this.options.label) {
			this.$e.text(this._command.title);
		}
	}

	_updateTooltip(): void {
		const element = this.$e.getHTMLElement();
		const keybinding = this._keybindingService.lookupKeybindings(this._command.id)[0];
		const keybindingLabel = keybinding && this._keybindingService.getLabelFor(keybinding);

		element.title = keybindingLabel
			? localize('titleAndKb', "{0} ({1})", this._command.title, keybindingLabel)
			: this._command.title;
	}

	_updateClass(): void {
		if (this.options.icon) {
			const element = this.$e.getHTMLElement();
			const {command, altCommand} = (<MenuItemAction>this._action);
			if (this._command !== command) {
				element.classList.remove(command.iconClass);
			} else if (altCommand) {
				element.classList.remove(altCommand.iconClass);
			}
			element.classList.add('icon', this._command.iconClass);
		}
	}
}
