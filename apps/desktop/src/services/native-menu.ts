import type { NativeMenuHost, NativeMenuItem } from '@reflect/core'
import { Menu, MenuItem, Submenu, type PredefinedMenuItemOptions } from '@tauri-apps/api/menu'

// Inline item options lose their click handler once the submenu is built.
async function menuEntry(item: NativeMenuItem): Promise<MenuItem | PredefinedMenuItemOptions> {
  return item.kind === 'command'
    ? await MenuItem.new({
        id: item.id,
        text: item.text,
        ...(item.accelerator !== undefined ? { accelerator: item.accelerator } : {}),
        action: item.action,
      })
    : { item: item.item, ...(item.text !== undefined ? { text: item.text } : {}) }
}

/** Native menus through Tauri's menu API. Use this adapter only in the native shell. */
export function createTauriNativeMenuHost(): NativeMenuHost {
  return {
    async buildAppMenu(layouts) {
      const submenus = await Promise.all(
        layouts.map(
          async (layout) =>
            await Submenu.new({
              text: layout.text,
              items: await Promise.all(layout.items.map(menuEntry)),
            }),
        ),
      )
      const menu = await Menu.new({ items: submenus })
      return {
        async setAsAppMenu() {
          await menu.setAsAppMenu()
        },
        async assignNsAppRoles() {
          for (const [index, layout] of layouts.entries()) {
            const submenu = submenus[index]
            if (!submenu) {
              continue
            }
            if (layout.nsAppRole === 'windows') {
              await submenu.setAsWindowsMenuForNSApp()
            } else if (layout.nsAppRole === 'help') {
              await submenu.setAsHelpMenuForNSApp()
            }
          }
        },
      }
    },
    async popup(items) {
      const menuItems = await Promise.all(
        items.map((item) => MenuItem.new({ text: item.text, action: item.action })),
      )
      const menu = await Menu.new({ items: menuItems })
      await menu.popup()
    },
  }
}
