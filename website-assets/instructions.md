# Stage Manager for Owlbear Rodeo

Stage Manager helps you turn a crowded Owlbear Scene into something you can understand at a glance and operate confidently while your players are waiting. Use virtual layers to arrange related scenery, prepare alternate versions of a location, and keep the controls you need during play close at hand.

## Overview

The outline mirrors the current Scene. Select an item to select it on the map, double-click it to center the viewport, or use Search when you remember a name but not where an object lives.

### Prepare the panel for your game

Open **Settings** beside Search before you begin arranging a Scene.

- Under **Features**, keep only the controls you expect to use.
  - Inheritance: allows you to enforce property states for all items in a virtual or native layer.
  - Transparency: Make an item invisible, even to the GM.
  - Interaction: Turn off the ability to click on an item.
  - Locked/Unlocked: Keep an item from being accidentally moved or resized.
  - Visible/Hidden: Hide or reveal an item to the players (or cut/uncut fog).
- Under **Show layers**, hide native Owlbear layers that are irrelevant to you. Every row includes its current item count, so a nonzero count can reveal scenery filed somewhere unexpected. These choices also simplify Send to Layer menus.

Settings are per device. They change your working view, not the Scene itself, and never remove existing state or inheritance. This makes it safe to simplify the panel differently for prep and play.

## Build a scene in layers

Start with groups that describe how you think about the location. In a manor map, useful virtual layers might be:

- Maps: **Ground**, **Upper Floor**, and **Roof**
- Props: **Furniture**, **Doors**, **Clues**, and **Rubble**
- Characters: **Guests**, **Servants**, and **Enemies**

Select the add button on a native-layer heading to create a virtual layer. Drag items into it, then drag the virtual-layer headings into the stacking order you want. Items stay in their native Owlbear layer, so a Props virtual layer cannot move above Characters, but virtual layers give you dependable ordering inside each native layer.

Once a native layer has virtual layers, **Unassigned** collects anything not yet organized. Treat that group as a prep checklist: when it contains an unexpected item, either file the item or deliberately leave it there. Virtual layers and Unassigned start collapsed, keeping a large Scene readable; select a heading when you need its contents.

### Link one idea across several native layers

Give virtual layers exactly the same name when they represent one concept in different native Owlbear layers. For example, create **Roof** in Maps and **Roof** in Props. The chain glyph shows that they are linked. A direct transparency, interaction, lock, or visibility change made on one eligible Roof group is applied to the other, allowing one decision to affect all of the artwork that makes up the roof.

Use linking for concepts that should behave together: a ship and its deck props, a secret chamber and its clues, or a weather effect assembled from Maps, Props, and Drawings. Rename one group when it needs to become independent again.

## Create dramatic scene states or even virtual vertical levels

State-linked virtual layers are useful when a location changes but stays in the same location on the battle map: doors open, a bridge collapses, a building burns, the party descends into the next level of the dungeon, or a magical realm replaces the ordinary one.

Name each alternative with the same virtual-layer group name, a colon, and a different state label:

- Temple: Rooftop
- Temple: Upper Floor
- Temple: Ground Floor
- Temple: Crypt

The group name and state label may be any non-empty text. Spaces around the colon are trimmed, and names are matched without regard to capitalization. These groups form a mutually exclusive transparency family, marked by a green Transparency control. By making objects invisible (scaled to 0x0) rather than hidden, unused objects from one state or level won't visually interfere with the GM's view of the current state or level.

During prep, make every alternative except the opening state transparent. During play, restore the alternative you want to reveal. Stage Manager automatically makes the other states in that virtual-layer group transparent, so only the chosen version—or its set of exact-name linked layers—remains on the map. If one state uses artwork in several native layers, repeat the exact full name, such as `Manor: Burning`, in each layer to link that state together.

When state-linked virtual layers exist, the fixed scene-state switcher below the Stage Manager header lists each group and its available states. Select a state there to restore it and make the other states in its group transparent without finding those layers in the hierarchy. Drag the state buttons to arrange them in the order that best fits the scene, then use the arrow buttons at either end to step backward or forward through that order.

This technique lets you stage a transformation as a single calm action instead of hiding and revealing dozens of objects while narrating. Restoring an item returns its saved scale and image-label opacity. Explicit inheritance instructions still take priority, so avoid enforcing a conflicting transparency value on a family you intend to switch live.

## Use inheritance to remove repetitive work

Inheritance is most useful for rules that should remain true as you continue editing. Enable **Manage inheritance** in Settings, then open the inheritance control on a native layer.

For example, you might enforce **Locked** and **Click-through** on Maps so every map image remains locked and click-through, including images added later. Leave Visibility and Transparency unenforced so those states remain available for scene changes.

Virtual layers normally **Pass thru** their parent instructions. Choose **Independent** for a genuine exception—for example, an interactive map element that must receive clicks—and enforce only the replacement values that group should supply. An individual item can also be made Independent for a one-off exception.

Gold indicates an instruction is active, blue indicates mixed direct values, and red identifies an Independent break in the chain. If the rules become harder to understand than the Scene, simplify them: use inheritance for stable policies and direct controls for moment-to-moment staging.

## Run the game from the outline

The outline is most valuable when it keeps your attention on the table rather than on scene management.

- **Search** for a named clue, creature, room, or effect instead of unfolding every layer.
- Select **Total** to collapse or restore the entire hierarchy while leaving the scene-state switcher available.
- **Locate** centers the viewport on an item without changing your zoom and briefly highlights its bounds.
- **Show/Hide** is ideal for spoilers, creatures waiting offstage, and clues that should appear at the right moment.
- **Lock** finished scenery so an accidental drag cannot disrupt the map.
- **Interaction** makes roofs, overlays, and other covering artwork click-through while leaving them manageable from Stage Manager.
- **Transparency families** switch prepared location states while you continue narrating.
- **Send** moves selected objects between native or virtual layers and adjusts their stacking position without hunting through the canvas.


## Quick actions

### Create virtual layer

Creates a named group inside a native Owlbear layer. Creating the first virtual layer also reveals an *Unassigned* virtual layer. Virtual layers can be reordered but cannot be nested.

### State inheritance and overrides

Opens the inheritance window. On native layers, an enabled **Enforce** switch keeps that state applied to the items in the layer, including items added later. Virtual layers and Unassigned can Pass thru those rules or become Independent. On an item, the control chooses whether it follows its parent rules. Item-state features hidden in Settings are also omitted here; hiding a control does not delete an existing rule.

### Make transparent / Restore

Makes eligible contents fully transparent (even to the GM) by setting their scale to zero, or restores their saved scale and image-label opacity. A radiating glyph represents the transparent state; a filled circle represents the ordinary opaque state. A green control identifies a mutually exclusive state family.

### Disable / Enable clicks

Makes eligible items click-through or interactive. Click-through items remain available in Stage Manager, which is often the easiest place to select them again.

### Lock / Unlock

Locks or unlocks eligible contents.

### Show / Hide

Shows or hides eligible contents. Fog uses Cut and Uncut equivalents.

### Send

**to Front**, **Forward**, **Backward**, and **to Back** adjust stacking within virtual-layer boundaries. **to Layer** moves selected items to another native or virtual layer. Using *to Layer* on a virtual layer or Unassigned moves its contents after confirmation; it does not nest the group.

### Delete

Deletes a virtual layer, not its items. Its contents become Unassigned, or return directly to their native layer when no virtual layers remain there.

### Edit

Renames a virtual layer. Matching names link; changing a linked name separates that group without changing its current item states.

### Locate

Centers the viewport on an item and briefly highlights its bounds.

## Owlbear context menu

Stage Manager adds **Send** to Owlbear Rodeo's item context menu. It uses the current canvas selection and offers the same stacking commands and native or virtual destinations as the outline, which is useful when the objects you want are already selected on the map.
