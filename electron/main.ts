/* eslint-disable @typescript-eslint/ban-ts-comment */
import {
  heroicConfigPath,
  heroicGamesConfigPath,
  launchGame,
  legendaryBin,
  loginUrl,
  getAlternativeWine,
  isLoggedIn,
  legendaryConfigPath,
  userInfo,
  writeDefaultconfig,
  writeGameconfig,
  getLatestDxvk,
  home,
  sidInfoUrl,
  updateGame,
  checkForUpdates,
  showAboutWindow,
  kofiURL,
  handleExit,
  heroicGithubURL,
  iconDark,
  getSettings,
  iconLight,
  heroicFolder,
} from './utils'

// @ts-ignore
import byteSize from 'byte-size'
import { spawn, exec } from 'child_process'
import * as path from 'path'
import isDev from 'electron-is-dev'
import i18next from 'i18next'
import Backend from 'i18next-fs-backend'

import {
  stat,
  readFileSync,
  writeFile,
  existsSync,
  mkdirSync,
  unlinkSync,
  writeFileSync,
} from 'graceful-fs'
import { promisify } from 'util'
import axios from 'axios'
import { userInfo as user, cpus } from 'os'

const execAsync = promisify(exec)
const statAsync = promisify(stat)

import {
  app,
  BrowserWindow,
  ipcMain,
  Notification,
  Menu,
  Tray,
  powerSaveBlocker,
} from 'electron'
import { Game, InstalledInfo, KeyImage } from './types.js'
let mainWindow: BrowserWindow = null

function createWindow(): BrowserWindow {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: isDev ? 1800 : 1280,
    height: isDev ? 1200 : 720,
    minHeight: 700,
    minWidth: 1200,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
    },
  })
  setTimeout(() => {
    getLatestDxvk()
  }, 2500)

  //load the index.html from a url
  if (isDev) {
    //@ts-ignore
    import('electron-devtools-installer').then((devtools) => {
      const { default: installExtension, REACT_DEVELOPER_TOOLS } = devtools

      installExtension(REACT_DEVELOPER_TOOLS).catch((err: any) => {
        console.log('An error occurred: ', err)
      })
    })
    mainWindow.loadURL('http://localhost:3000')
    // Open the DevTools.
    mainWindow.webContents.openDevTools()

    mainWindow.on('close', async (e) => {
      e.preventDefault()
      const { exitToTray } = getSettings('default')

      if (exitToTray) {
        return mainWindow.hide()
      }

      return await handleExit()
    })
  } else {
    mainWindow.on('close', async (e) => {
      e.preventDefault()
      const { exitToTray } = getSettings('default')

      if (exitToTray) {
        return mainWindow.hide()
      }
      return handleExit()
    })
    mainWindow.loadURL(`file://${path.join(__dirname, '../build/index.html')}`)
    mainWindow.setMenu(null)

    return mainWindow
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
let appIcon: Tray = null
let window: BrowserWindow = null
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance, we should focus our window.
    if (window) {
      if (window.isMinimized()) {
        window.restore()
        window.focus()
      }
    }
  })
  app.whenReady().then(async () => {
    const { language, darkTrayIcon } = getSettings('default')

    await i18next.use(Backend).init({
      lng: language,
      fallbackLng: 'en',
      supportedLngs: ['en', 'pt', 'de', 'ru'],
      debug: false,
      backend: {
        allowMultiLoading: false,
        addPath: path.join(__dirname, '/locales/{{lng}}/{{ns}}'),
        loadPath: path.join(__dirname, '/locales/{{lng}}/{{ns}}.json'),
      },
    })

    window = createWindow()

    const trayIcon = darkTrayIcon ? iconDark : iconLight
    appIcon = new Tray(trayIcon)

    const contextMenu = Menu.buildFromTemplate([
      {
        label: i18next.t('tray.show'),
        click: function () {
          mainWindow.show()
        },
      },
      {
        label: i18next.t('tray.reload', 'Reload'),
        click: function () {
          mainWindow.reload()
        },
        accelerator: 'ctrl + R',
      },
      {
        label: i18next.t('tray.about', 'About'),
        click: function () {
          showAboutWindow()
        },
      },
      {
        label: 'Github',
        click: function () {
          exec(`xdg-open ${heroicGithubURL}`)
        },
      },
      {
        label: i18next.t('tray.support', 'Support Us'),
        click: function () {
          exec(`xdg-open ${kofiURL}`)
        },
      },
      {
        label: i18next.t('tray.quit', 'Quit'),
        click: function () {
          handleExit()
        },
      },
    ])

    appIcon.setContextMenu(contextMenu)
    appIcon.setToolTip('Heroic')
    ipcMain.on('changeLanguage', async (event, language: string) => {
      await i18next.changeLanguage(language)
      appIcon.setContextMenu(contextMenu)
    })
    return
  })
}

ipcMain.on('Notify', (event, args) => {
  const notify = new Notification({
    title: args[0],
    body: args[1],
  })

  notify.on('click', () => mainWindow.show())
  notify.show()
})

ipcMain.on('openSupportPage', () => exec(`xdg-open ${kofiURL}`))

ipcMain.on('openReleases', () => exec(`xdg-open ${heroicGithubURL}`))

ipcMain.handle('checkVersion', () => checkForUpdates())

ipcMain.handle('writeLibrary', async () => {
  const { stdout, stderr } = await execAsync('legendary list-games --json')
  if (stdout) {
    const results = JSON.parse(stdout)
    // NEED DOUBLE CHECK IF SOMETHINGS INSIDE IS NEEDED OR ADD MORE STUFF IT REDUCE SIZE OF THE FINAL FILE
    // There is maybe a better way to do that tried with filter but still not work
    results.map((res: any) => {
      delete res.asset_info
      delete res.metadata.creationDate
      delete res.metadata.developerId
      delete res.metadata.dlcItemList
      delete res.metadata.endOfSupport
      delete res.metadata.entitlementName
      delete res.metadata.entitlementType
      delete res.metadata.lastModifiedDate
      delete res.metadata.releaseInfo
      res.metadata.keyImages.map((k: any) => {
        delete k.height
        delete k.md5
        delete k.size
        delete k.uploadedDate
        delete k.width
      })
    })
    const json = JSON.stringify(results)
    return writeFileSync(`${heroicFolder}library.json`, json)
  } else if (stderr) {
    return stderr
  } else {
    return 'done'
  }
})

ipcMain.handle('writeFile', (event, args) => {
  const app = args[0]
  const config = args[1]
  if (args[0] === 'default') {
    return writeFile(
      heroicConfigPath,
      JSON.stringify(config, null, 2),
      () => 'done'
    )
  }
  return writeFile(
    `${heroicGamesConfigPath}/${app}.json`,
    JSON.stringify(config, null, 2),
    () => 'done'
  )
})

let powerId: number | null
ipcMain.on('lock', () => {
  if (!existsSync(`${heroicGamesConfigPath}/lock`)) {
    writeFile(`${heroicGamesConfigPath}/lock`, '', () => 'done')
    if (!powerId) {
      powerId = powerSaveBlocker.start('prevent-app-suspension')
    }
  }
})

ipcMain.on('unlock', () => {
  if (existsSync(`${heroicGamesConfigPath}/lock`)) {
    unlinkSync(`${heroicGamesConfigPath}/lock`)
    if (powerId) {
      powerSaveBlocker.stop(powerId)
    }
  }
})

ipcMain.handle('getMaxCpus', () => cpus().length)

ipcMain.on('quit', async () => handleExit())

/* const storage: Storage = mainWindow.localStorage
const lang = storage.getItem('language') */

ipcMain.handle('getGameInfo', async (event, game) => {
  let lang = JSON.parse(readFileSync(heroicConfigPath, 'utf-8')).defaultSettings
    .language
  if (lang === 'pt') {
    lang = 'pt-BR'
  }
  const epicUrl = `https://store-content.ak.epicgames.com/api/${lang}/content/products/${game}`
  try {
    const response = await axios({
      url: epicUrl,
      method: 'GET',
    })
    return response.data.pages[0].data.about
  } catch (error) {
    return {}
  }
})

ipcMain.handle('launch', (event, appName) => {
  console.log('launching', appName)

  return launchGame(appName).catch(console.log)
})

ipcMain.handle('legendary', async (event, args) => {
  const command = `${legendaryBin} ${args}`
  return await execAsync(command)
    .then(({ stdout, stderr }) => {
      if (stdout) {
        return stdout
      } else if (stderr) {
        return stderr
      } else {
        return 'done'
      }
    })
    .catch((err) => console.log(err))
})

ipcMain.handle('install', async (event, args) => {
  const { appName: game, path } = args
  const { defaultInstallPath, maxWorkers } = getSettings('default')
  const workers = maxWorkers ? `--max-workers ${maxWorkers}` : ''

  const logPath = `${heroicGamesConfigPath}${game}.log`
  let command = `${legendaryBin} install ${game} --base-path '${path}' ${workers} -y &> ${logPath}`
  if (path === 'default') {
    command = `${legendaryBin} install ${game} --base-path ${defaultInstallPath} ${workers} -y |& tee ${logPath}`
  }
  console.log(`Installing ${game} with:`, command)
  await execAsync(command, { shell: '/bin/bash' })
    .then(() => console.log('finished installing'))
    .catch((err) => console.log(err))
})

ipcMain.handle('repair', async (event, game) => {
  const { maxWorkers } = getSettings('default')
  const workers = maxWorkers ? `--max-workers ${maxWorkers}` : ''

  const logPath = `${heroicGamesConfigPath}${game}.log`
  const command = `${legendaryBin} repair ${game} ${workers} -y &> ${logPath}`

  console.log(`Repairing ${game} with:`, command)
  await execAsync(command, { shell: '/bin/bash' })
    .then(() => console.log('finished repairing'))
    .catch(console.log)
})

ipcMain.handle('importGame', async (event, args) => {
  const { appName: game, path } = args
  const command = `${legendaryBin} import-game ${game} '${path}'`
  const { stderr, stdout } = await execAsync(command, { shell: '/bin/bash' })
  console.log(`${stdout} - ${stderr}`)
  return
})

ipcMain.handle('updateGame', (e, appName) => updateGame(appName))

ipcMain.handle('requestGameProgress', async (event, appName) => {
  const logPath = `${heroicGamesConfigPath}${appName}.log`
  const command = `tail ${logPath} | grep 'Progress: ' | awk '{print $5 $6 $11}'`
  const { stdout } = await execAsync(command)
  const status = `${stdout.split('\n')[0]}`.split('(')
  const percent = status[0]
  const eta = status[1] ? status[1].split(',')[1] : ''
  const bytes = status[1] ? status[1].split(',')[0].replace(')', 'MB') : ''
  if (percent && bytes && eta) {
    const progress = { percent, bytes, eta }
    console.log(
      `Progress: ${appName} ${progress.percent}/${progress.bytes}/${eta}`
    )
    return progress
  }
  return ''
})

ipcMain.on('kill', (event, game) => {
  console.log('killing', game)
  return spawn('pkill', ['-f', game])
})

ipcMain.on('openFolder', (event, folder) => spawn('xdg-open', [folder]))

ipcMain.handle('getAlternativeWine', () => getAlternativeWine())

// Calls WineCFG or Winetricks. If is WineCFG, use the same binary as wine to launch it to dont update the prefix
interface Tools {
  tool: string
  wine: string
  prefix: string
  exe: string
}

ipcMain.on('callTool', async (event, { tool, wine, prefix, exe }: Tools) => {
  const wineBin = wine.replace("/proton'", "/dist/bin/wine'")
  let winePrefix: string = prefix

  if (wine.includes('proton')) {
    const protonPrefix = winePrefix.replaceAll("'", '')
    winePrefix = `'${protonPrefix}/pfx'`
  }

  let command = `WINE=${wineBin} WINEPREFIX=${winePrefix} ${
    tool === 'winecfg' ? `${wineBin} ${tool}` : tool
  }`

  if (tool === 'runExe') {
    command = `WINEPREFIX=${winePrefix} ${wineBin} ${exe}`
  }

  console.log({ command })
  return exec(command)
})

ipcMain.handle('requestSettings', (event, appName) => {
  if (appName === 'default') {
    return getSettings('default')
  }

  if (appName !== 'default') {
    writeGameconfig(appName)
  }

  return getSettings(appName)
})

//Checks if the user have logged in with Legendary already
ipcMain.handle('isLoggedIn', () => isLoggedIn())

ipcMain.on('openLoginPage', () => spawn('xdg-open', [loginUrl]))

ipcMain.on('openSidInfoPage', () => spawn('xdg-open', [sidInfoUrl]))

ipcMain.on('getLog', (event, appName) =>
  spawn('xdg-open', [`${heroicGamesConfigPath}/${appName}-lastPlay.log`])
)

const installed = `${legendaryConfigPath}/installed.json`

ipcMain.handle('moveInstall', async (event, [appName, path]: string[]) => {
  const file = JSON.parse(readFileSync(installed, 'utf8'))
  const installedGames: Game[] = Object.values(file)
  const { install_path } = installedGames.filter(
    (game) => game.app_name === appName
  )[0]

  const splitPath = install_path.split('/')
  const installFolder = splitPath[splitPath.length - 1]
  const newPath = `${path}/${installFolder}`
  const game: Game = { ...file[appName], install_path: newPath }
  const modifiedInstall = { ...file, [appName]: game }
  return await execAsync(`mv -f ${install_path} ${newPath}`)
    .then(() => {
      writeFile(installed, JSON.stringify(modifiedInstall, null, 2), () =>
        console.log(`Finished moving ${appName} to ${newPath}`)
      )
    })
    .catch(console.log)
})

const heroicImagesFolder = `${__dirname}/images`

const getCover = (appName: string, type: string, url: string) => {
  const imagePath = `${heroicImagesFolder}/${appName}-${type}.png`
  const imageOffline = existsSync(imagePath)

  if (imageOffline) {
    return `images/${appName}-${type}.png`
  }

  url = url.replaceAll(' ', '%20')

  const downloadCommand = `curl -L '${url}' -o ${heroicImagesFolder}/${appName}-${type}.png`
  exec(downloadCommand)
  return `images/${appName}-${type}.png`
}

ipcMain.handle('readFile', async (event, file) => {
  const loggedIn = isLoggedIn()

  if (!isLoggedIn) {
    return { user: { displayName: null }, library: [] }
  }

  const files: any = {
    user: loggedIn
      ? JSON.parse(readFileSync(userInfo, 'utf8'))
      : { displayName: null },
    library: `${legendaryConfigPath}/metadata/`,
    config: heroicConfigPath,
    installed: await statAsync(installed)
      .then(() => JSON.parse(readFileSync(installed, 'utf-8')))
      .catch(() => []),
  }

  if (file === 'user') {
    if (loggedIn) {
      writeDefaultconfig()
      return files[file].displayName
    }
    return null
  }

  if (file === 'library') {
    const library = existsSync(`${heroicFolder}library.json`)
    const fallBackImage =
      'https://user-images.githubusercontent.com/26871415/103480183-1fb00680-4dd3-11eb-9171-d8c4cc601fba.jpg'

    if (library) {
      return JSON.parse(readFileSync(`${heroicFolder}library.json`, 'utf-8'))
        .map(
          (c: {
            metadata: {
              description: any
              keyImages: any
              title: any
              developer: any
              customAttributes: { CloudSaveFolder: any; FolderName: any }
            }
            app_name: string
            app_version: string
            dlcs: string[]
          }) => {
            const {
              description,
              keyImages,
              title,
              developer,
              customAttributes: { CloudSaveFolder, FolderName },
            } = c.metadata
            const app_name = c.app_name
            const dlcs = c.dlcs
            const cloudSaveEnabled = Boolean(CloudSaveFolder)
            const saveFolder = cloudSaveEnabled ? CloudSaveFolder.value : ''
            const installFolder = FolderName ? FolderName.value : ''
            const gameBox = keyImages.filter(
              ({ type }: KeyImage) => type === 'DieselGameBox'
            )[0]
            const gameBoxTall = keyImages.filter(
              ({ type }: KeyImage) => type === 'DieselGameBoxTall'
            )[0]
            const logo = keyImages.filter(
              ({ type }: KeyImage) => type === 'DieselGameBoxLogo'
            )[0]

            const art_cover = gameBox ? gameBox.url : fallBackImage
            const art_logo = logo ? getCover(app_name, 'logo', logo.url) : null
            const art_square = gameBoxTall ? gameBoxTall.url : fallBackImage

            const cover = getCover(app_name, 'cover', art_cover)
            const square = getCover(app_name, 'square', art_square)

            const installedGames: Game[] = Object.values(files.installed)

            const isInstalled = Boolean(
              installedGames.filter((game) => game.app_name === app_name).length
            )
            const info = isInstalled
              ? installedGames.filter((game) => game.app_name === app_name)[0]
              : {}

            const {
              executable = null,
              version = c.app_version,
              install_size = null,
              install_path = null,
            } = info as InstalledInfo

            const convertedSize =
              install_size &&
              `${byteSize(install_size).value}${byteSize(install_size).unit}`

            return {
              isInstalled,
              info,
              title,
              executable,
              version,
              install_size: convertedSize,
              install_path,
              app_name,
              developer,
              description,
              cloudSaveEnabled,
              saveFolder,
              folderName: installFolder,
              art_cover: cover,
              art_square: square,
              art_logo,
              dlcs,
            }
          }
        )
        .sort((a: { title: string }, b: { title: string }) => {
          const gameA = a.title.toUpperCase()
          const gameB = b.title.toUpperCase()
          return gameA < gameB ? -1 : 1
        })
    }
    return []
  }
  return files[file]
})

ipcMain.handle('egsSync', async (event, args) => {
  const linkArgs = `--enable-sync --egl-wine-prefix ${args}`
  const unlinkArgs = `--unlink`
  const isLink = args !== 'unlink'
  const command = isLink ? linkArgs : unlinkArgs

  try {
    const { stderr, stdout } = await execAsync(
      `${legendaryBin} egl-sync ${command} -y`
    )
    console.log(`${stdout} - ${stderr}`)
    return `${stdout} - ${stderr}`
  } catch (error) {
    return 'Error'
  }
})

ipcMain.handle('getUserInfo', () => {
  const { account_id } = JSON.parse(readFileSync(userInfo, 'utf-8'))
  return { user: user().username, epicId: account_id }
})

ipcMain.on('removeFolder', (e, args: string[]) => {
  const [path, folderName] = args

  if (path === 'default') {
    const defaultInstallPath = getSettings(
      'default'
    ).defaultInstallPath.replaceAll("'", '')
    const folderToDelete = `${defaultInstallPath}/${folderName}`
    return setTimeout(() => {
      exec(`rm -Rf ${folderToDelete}`)
    }, 2000)
  }

  const folderToDelete = `${path}/${folderName}`
  return setTimeout(() => {
    exec(`rm -Rf ${folderToDelete}`)
  }, 2000)
})

ipcMain.handle('syncSaves', async (event, args) => {
  const [arg = '', path, appName] = args

  const command = `${legendaryBin} sync-saves --save-path "${path}" ${arg} ${appName} -y`
  const legendarySavesPath = `${home}/legendary/.saves`

  //workaround error when no .saves folder exists
  if (!existsSync(legendarySavesPath)) {
    mkdirSync(legendarySavesPath, { recursive: true })
  }

  console.log('\n syncing saves for ', appName)
  const { stderr, stdout } = await execAsync(command)
  console.log(`${stdout} - ${stderr}`)
  return `\n ${stdout} - ${stderr}`
})

ipcMain.on('showAboutWindow', () => showAboutWindow())

// Maybe this can help with white screens
process.on('uncaughtException', (err) => {
  console.log(err)
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
