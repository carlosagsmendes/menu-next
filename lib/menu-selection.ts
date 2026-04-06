import type { MenuItemId } from "@/lib/menu";

const MENU_SELECTION_OVERRIDE_EVENT = "menu:select-override";
const menuSelectionOverrideTarget = new EventTarget();

type MenuSelectionOverrideDetail = {
  id: MenuItemId;
};

type MenuSelectionOverrideEvent = CustomEvent<MenuSelectionOverrideDetail>;

export function dispatchMenuSelectionOverride(id: MenuItemId) {
  menuSelectionOverrideTarget.dispatchEvent(
    new CustomEvent<MenuSelectionOverrideDetail>(MENU_SELECTION_OVERRIDE_EVENT, {
      detail: { id },
    })
  );
}

export function subscribeToMenuSelectionOverride(
  listener: (id: MenuItemId) => void
) {
  const handleEvent = (event: Event) => {
    listener((event as MenuSelectionOverrideEvent).detail.id);
  };

  menuSelectionOverrideTarget.addEventListener(
    MENU_SELECTION_OVERRIDE_EVENT,
    handleEvent
  );

  return () => {
    menuSelectionOverrideTarget.removeEventListener(
      MENU_SELECTION_OVERRIDE_EVENT,
      handleEvent
    );
  };
}
