export class ExpanseNPCSheet extends ActorSheet {

    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            classes: ["sheet", "actor", "npc"],
            width: 480,
            height: 450,
            tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "abilities" }],
            dragDrop: [{ dragSelector: ".item-list .item", dropSelector: null }]
        });
    }

    // Picks between available/listed templates
    get template() {
        const path = "systems/the_expanse/templates/sheet"
        return `${path}/${this.actor.data.type}-sheet.html`;
    }

    getData() {
        const data = super.getData();
        console.log(data);
        //data.dtypes = ["String", "Number", "Boolean"];
        let sheetData = {};

        sheetData.dtypes = ["String", "Number", "Boolean"];
        sheetData.name = data.actor.data.name;
        sheetData.stunts = data.actor.items.filter(i => i.type === "stunt");
        sheetData.talent = data.actor.items.filter(i => i.type === "talent");
        sheetData.items = data.actor.items.filter(i => i.type === "items");
        sheetData.weapon = data.actor.items.filter(i => i.type === "weapon");
        sheetData.armor = data.actor.items.filter(i => i.type === "armor");
        sheetData.shield = data.actor.items.filter(i => i.type === "shield");
        sheetData.conditions = data.data.data.conditions;
        sheetData.level = data.data.data.attributes.level;
        sheetData.attributes = data.data.data.attributes;
        sheetData.abilities = data.data.data.abilities;
        sheetData.bio = data.data.data.bio;
        //temp fix. new actors shouldnt need this
        sheetData.info = data.data.data;
        sheetData.img = data.actor.data.img;
        sheetData.threat = data.data.data.threat;
        sheetData.notes = data.data.data.notes;
        sheetData.stunts = data.data.data.stunts;
        sheetData.talent1 = data.data.data.talent1;
        sheetData.talent2 = data.data.data.talent2;
        sheetData.equipment1 = data.data.data.equipment1;
        sheetData.equipment2 = data.data.data.equipment2;
        console.log(sheetData);

        sheetData.items.sort((a, b) => {
            return a.name.localeCompare(b.name);
        });


        for (let [k, v] of Object.entries(sheetData.weapon)) {
            if (v.type === "weapon") {
                console.log(v.data.data);
                const weapon = duplicate(this.actor.getEmbeddedDocument("Item", v.id));
                let modifierStat = v.data.data.modifier
                let bonusDamage = 0; // get stat from actorData
                let useFocus = v.data.data.usefocus;
                let focusBonus = useFocus ? 2 : 0;
                let toHitMod = v.data.data.type;
                let modType = "";

                switch (modifierStat) {
                    case 'dex':
                        bonusDamage = data.actor.data.data.abilities.dexterity.rating;
                        break;
                    case 'per':
                        bonusDamage = data.actor.data.data.abilities.perception.rating;
                        break;
                    case 'str':
                        bonusDamage = data.actor.data.data.abilities.strength.rating;
                        break;
                }

                if (bonusDamage > 0) {
                    v.data.data.hasBonusDamage = true;
                } else {
                    v.data.data.hasBonusDamage = false;
                }

                v.data.data.bonusDamage = bonusDamage;

                switch (toHitMod) {
                    case "unarmed":
                    case "makeshift":
                    case "light_melee":
                    case "heavy_melee":
                        modType = "fighting";
                        v.data.data.attack = data.actor.data.data.abilities.fighting.rating;
                        break;
                    case "pistol":
                    case "rifle":
                        modType = "accuracy";
                        v.data.data.attack = data.actor.data.data.abilities.accuracy.rating;
                        break;
                    default:
                        modType = "fighting";
                        v.data.data.attack = data.actor.data.data.abilities.fighting.rating;
                        break;
                }
                v.data.data.tohitabil = modType;
                v.data.data.attack += focusBonus;
                this.actor.updateEmbeddedDocuments("Item", [v])
            }
        }
        return sheetData;
    }

    activateListeners(html) {
        super.activateListeners(html);
        let tabs = html.find('tabs');
        let initial = this._sheetTab;
        new TabsV2(tabs, {
            initial: initial,
            callback: clicked => this._sheetTab = clicked.data("tab")
        });

        if (!this.options.editable) return;

        // Update Inventory Item
        html.find(".item-edit").click((ev) => {
            let itemId = $(ev.currentTarget).parents(".item").attr("data-item-id");
            const item = this.actor.items.get(itemId);
            item.sheet.render(true);
        });

        // Delete Inventory Item
        html.find(".item-delete").click((ev) => {
            let li = $(ev.currentTarget).parents(".item"),
                itemId = li.attr("data-item-id");
            this.actor.deleteEmbeddedEntity("Item", itemId);
            li.slideUp(200, () => this.render(false));
        });

        html.find(".weapon-usefocus").click(e => {
            const data = super.getData()
            const items = data.items;
            let itemId = e.currentTarget.getAttribute("data-item-id");
            const weapon = duplicate(this.actor.getEmbeddedDocument("Item", itemId));
            for (let [k, v] of Object.entries(items)) {
                if (v.type === "weapon" && v._id === itemId) {
                    weapon.data.usefocus = !weapon.data.usefocus;
                }
            }
            this.actor.updateEmbeddedDocuments("Item", [weapon]);
        });

        html.find('.rollable').click(this._onRoll.bind(this));

        html.find('.npc-attack').click(this._onNPCAttack.bind(this));
    }
 
    _onNPCAttack(event) {
        event.preventDefault();
        const element = event.currentTarget;
        const dataset = element.dataset;

        const data = super.getData()
        const actorData = data.actor;
        const items = actorData.items;

        console.log(dataset);
        console.log(actorData);

        // Set variables for to hit
        let itemId = dataset.itemId;
        let itemToUse = actorData.data.items.filter(i => i.id === itemId);
        console.log(itemToUse);
        let itemUsed = itemToUse[0];
        console.log(itemUsed);
        let weaponToHitAbil = dataset.itemAbil;
        let useFocus = itemUsed.data.usefocus ? 2 : 0;
        let abilityMod = actorData.data.data.abilities[weaponToHitAbil].rating;
        let die1, die2, die3;
        let stuntPoints = "";
        let tn = 0;
        let rollCard = {};

        let toHitRoll = new Roll(`3D6 + @foc + @abm`, { foc: useFocus, abm: abilityMod }).roll({async: false});
        //toHitRoll.evaluate();
        [die1, die2, die3] = toHitRoll.terms[0].results.map(i => i.result);
        let toHit = Number(toHitRoll.total);
        console.log("To Hit Results:" + " " + die1 + " " + die2 + " " + die3 + " Use Focus: " + useFocus + " Ability Modifier: " + abilityMod);

        if (die1 == die2 || die1 == die3 || die2 == die3) {
            stuntPoints = `<b>${die3} Stunt Points have been generated!</b></br>`;
        };

        let label = useFocus ? `<b> Rolling ${weaponToHitAbil} with focus </b>` : `Rolling ${weaponToHitAbil}`;
        // Set variables for damage roll
        let diceFormula = itemUsed.data.data.damage;
        let bonusDamage = itemUsed.data.data.bonusDamage;
        
        let damageRoll = new Roll(`${diceFormula} + @bd`, { bd: bonusDamage }).roll({async: false});
        //damageRoll.evaluate();
        let damageOnHit = damageRoll.total;
        console.log(damageRoll);
        this.TargetNumber().then(target => {
            tn = Number(target);
            const toHitSuccess = `Your Attack roll of ${toHit} <b>SUCCEEDS</b> against a Target Number of ${tn}.</br>`;
            const toHitFail = `Your Attack roll of ${toHit} with the ${itemUsed.data.name} <b>FAILS</b> against a Target Number of ${tn}.</br>`;
            const damageTotal = `Your attack with the ${itemUsed.data.name} does ${damageOnHit} points of damage.</br> 
                Subtract the enemies Toughness and Armor for total damage received`;
            if (toHit >= tn) {
                rollCard = toHitSuccess + stuntPoints + damageTotal
                ChatMessage.create({
                    speaker: ChatMessage.getSpeaker({ actor: this.actor }),
                    flavor: label,
                    content: rollCard
                });
            } else {
                rollCard = toHitFail, stuntPoints
                ChatMessage.create({
                    speaker: ChatMessage.getSpeaker({ actor: this.actor }),
                    flavor: label,
                    content: rollCard
                });
            }
        });
    }
 
    _onRoll(event) {
        event.preventDefault();
        const element = event.currentTarget;
        const dataset = element.dataset;
        console.log(dataset);
        if (dataset.roll) {
            let roll = new Roll(dataset.roll, this.actor.data.data).roll({async: false});

            let rollCard;
            let die1 = 0; let die2 = 0; let die3 = 0;
            let useFocus = roll.data.abilities[dataset.label].useFocus ? 2 : 0;
            let abilityMod = roll.data.abilities[dataset.label].rating;

            [die1, die2, die3] = roll.terms[0].results.map(i => i.result);

            let label = useFocus ? `<b> Rolling ${dataset.label} with focus </b>` : `Rolling ${dataset.label}`;
            let results = [die1, die2, die3];
            let resultsSum = die1 + die2 + die3 + useFocus + abilityMod;

            if (die1 == die2 || die1 == die3 || die2 == die3) {
                rollCard = ` 
              <b>Dice Roll:</b> ${results} <br> 
              <b>Ability Test Results:</b> ${resultsSum} <br>
              <b>${die3} Stunt Points have been generated!</b>
              `
            } else {
                rollCard = ` 
              <b>Dice Roll:</b> ${results} <br> 
              <b>Ability Test Results:</b> ${resultsSum}
              `
            }
            console.log(rollCard);

            ChatMessage.create({
                speaker: ChatMessage.getSpeaker({ actor: this.actor }),
                flavor: label,
                content: rollCard
            });
            /*let label = dataset.label ? `Rolling ${dataset.label}` : '';*/
            /*roll.toMessage({
              speaker: ChatMessage.getSpeaker({ actor: this.actor }),
              flavor: label,
              rollCard
            });*/
        }
    }

    TargetNumber() {
        let tn = new Promise((resolve) => {
            renderTemplate("/systems/the_expanse/templates/dialog/target-number.html").then(dlg => {
                new Dialog({
                    title: game.i18n.localize("EXPANSE.TargetNumber"),
                    content: dlg,
                    buttons: {
                        roll: {
                            label: game.i18n.localize("EXPANSE.Roll"),
                            callback: html => {
                                resolve(html.find(`[name="targetInput"]`).val());
                            }
                        }
                    }
                }).render(true);
            });
        })
        return tn;
    }

    AttackDamage() {

    }

}