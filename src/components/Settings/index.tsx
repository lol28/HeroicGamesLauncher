import React, { useEffect, useState } from 'react'
import { NavLink, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { getGameInfo, writeConfig } from '../../helper'
import { useToggle } from '../../hooks'
import { AppSettings, WineProps } from '../../types'
import Header from '../UI/Header'
import GeneralSettings from './GeneralSettings'
import OtherSettings from './OtherSettings'
import SyncSaves from './SyncSaves'
import Tools from './Tools'
import WineSettings from './WineSettings'
import { IpcRenderer } from 'electron'

interface ElectronProps {
  ipcRenderer: IpcRenderer
}

const { ipcRenderer } = window.require('electron') as ElectronProps
const storage: Storage = window.localStorage
interface RouteParams {
  appName: string
  type: string
}

// TODO: add feedback when launching winecfg and winetricks

export default function Settings() {
  const { t } = useTranslation()

  const [wineVersion, setWineversion] = useState({
    name: 'Wine Default',
    bin: '/usr/bin/wine',
  } as WineProps)
  const [winePrefix, setWinePrefix] = useState('~/.wine')
  const [defaultInstallPath, setDefaultInstallPath] = useState('')
  const [otherOptions, setOtherOptions] = useState('')
  const [launcherArgs, setLauncherArgs] = useState('')
  const [egsLinkedPath, setEgsLinkedPath] = useState('')
  const [maxWorkers, setMaxWorkers] = useState(2)
  const [egsPath, setEgsPath] = useState(egsLinkedPath)
  const [language, setLanguage] = useState(
    () => storage.getItem('language') || ''
  )
  const [savesPath, setSavesPath] = useState('')
  const {
    on: useGameMode,
    toggle: toggleUseGameMode,
    setOn: setUseGameMode,
  } = useToggle(false)
  const { on: showFps, toggle: toggleFps, setOn: setShowFps } = useToggle(false)
  const {
    on: audioFix,
    toggle: toggleAudioFix,
    setOn: setAudioFix,
  } = useToggle(false)
  const {
    on: showMangohud,
    toggle: toggleMangoHud,
    setOn: setShowMangoHud,
  } = useToggle(false)
  const {
    on: exitToTray,
    toggle: toggleTray,
    setOn: setExitToTray,
  } = useToggle(false)
  const {
    on: darkTrayIcon,
    toggle: toggleDarkTrayIcon,
    setOn: setDarkTrayIcon,
  } = useToggle(false)
  const {
    on: autoInstallDxvk,
    toggle: toggleAutoInstallDxvk,
    setOn: setAutoInstallDxvk,
  } = useToggle(false)

  const [haveCloudSaving, setHaveCloudSaving] = useState({
    cloudSaveEnabled: false,
    saveFolder: '',
  })
  const [autoSyncSaves, setAutoSyncSaves] = useState(false)
  const [altWine, setAltWine] = useState([] as WineProps[])

  const { appName, type } = useParams() as RouteParams
  const isDefault = appName === 'default'
  const isGeneralSettings = type === 'general'
  const isWineSettings = type === 'wine'
  const isSyncSettings = type === 'sync'
  const isOtherSettings = type === 'other'

  useEffect(() => {
    const getSettings = async () => {
      const config: AppSettings = await ipcRenderer.invoke(
        'requestSettings',
        appName
      )
      setUseGameMode(config.useGameMode || false)
      setShowFps(config.showFps || false)
      setAudioFix(config.audioFix || false)
      setShowMangoHud(config.showMangohud || false)
      setDefaultInstallPath(config.defaultInstallPath)
      setWineversion(config.wineVersion)
      setWinePrefix(config.winePrefix)
      setOtherOptions(config.otherOptions)
      setLauncherArgs(config.launcherArgs)
      setEgsLinkedPath(config.egsLinkedPath || '')
      setEgsPath(config.egsLinkedPath || '')
      setAutoSyncSaves(config.autoSyncSaves)
      setExitToTray(config.exitToTray || false)
      setDarkTrayIcon(config.darkTrayIcon || false)
      setAutoInstallDxvk(config.autoInstallDxvk || false)
      setSavesPath(config.savesPath || '')
      setMaxWorkers(config.maxWorkers || 2)

      if (!isDefault) {
        const { cloudSaveEnabled, saveFolder } = await getGameInfo(appName)
        setHaveCloudSaving({ cloudSaveEnabled, saveFolder })
      }
    }
    getSettings()

    return () => {
      ipcRenderer.removeAllListeners('requestSettings')
    }
  }, [appName, type, isDefault])

  const GlobalSettings = {
    defaultSettings: {
      defaultInstallPath,
      wineVersion,
      winePrefix,
      otherOptions,
      useGameMode,
      egsLinkedPath,
      showFps,
      exitToTray,
      audioFix,
      showMangohud,
      language,
      darkTrayIcon,
      maxWorkers,
    },
  }

  const GameSettings = {
    [appName]: {
      wineVersion,
      winePrefix,
      otherOptions,
      launcherArgs,
      useGameMode,
      savesPath,
      showFps,
      autoSyncSaves,
      audioFix,
      autoInstallDxvk,
      showMangohud,
    },
  }

  const settingsToSave = isDefault ? GlobalSettings : GameSettings
  const returnPath = isDefault ? '/' : `/gameconfig/${appName}`

  useEffect(() => {
    writeConfig([appName, settingsToSave])
  }, [GlobalSettings, GameSettings, appName])

  return (
    <>
      <Header goTo={returnPath} renderBackButton />
      <div className="Settings">
        <div className="settingsNavbar">
          {isDefault && (
            <NavLink to={{ pathname: '/settings/default/general' }}>
              {t('settings.navbar.general')}
            </NavLink>
          )}
          <NavLink to={{ pathname: `/settings/${appName}/wine` }}>Wine</NavLink>
          {!isDefault && haveCloudSaving.cloudSaveEnabled && (
            <NavLink to={{ pathname: `/settings/${appName}/sync` }}>
              {t('settings.navbar.sync')}
            </NavLink>
          )}
          <NavLink to={{ pathname: `/settings/${appName}/other` }}>
            {t('settings.navbar.other')}
          </NavLink>
        </div>
        <div className="settingsWrapper">
          {isGeneralSettings && (
            <GeneralSettings
              egsPath={egsPath}
              setEgsPath={setEgsPath}
              egsLinkedPath={egsLinkedPath}
              setEgsLinkedPath={setEgsLinkedPath}
              defaultInstallPath={defaultInstallPath}
              setDefaultInstallPath={setDefaultInstallPath}
              exitToTray={exitToTray}
              toggleTray={toggleTray}
              language={language}
              setLanguage={setLanguage}
              maxWorkers={maxWorkers}
              setMaxWorkers={setMaxWorkers}
              toggleDarkTrayIcon={toggleDarkTrayIcon}
              darkTrayIcon={darkTrayIcon}
            />
          )}
          {isWineSettings && (
            <WineSettings
              altWine={altWine}
              setAltWine={setAltWine}
              wineVersion={wineVersion}
              winePrefix={winePrefix}
              setWineversion={setWineversion}
              setWinePrefix={setWinePrefix}
              autoInstallDxvk={autoInstallDxvk}
              toggleAutoInstallDxvk={toggleAutoInstallDxvk}
            />
          )}
          {isWineSettings && (
            <Tools winePrefix={winePrefix} wineVersion={wineVersion} />
          )}
          {isOtherSettings && (
            <OtherSettings
              otherOptions={otherOptions}
              setOtherOptions={setOtherOptions}
              launcherArgs={launcherArgs}
              setLauncherArgs={setLauncherArgs}
              useGameMode={useGameMode}
              toggleUseGameMode={toggleUseGameMode}
              showFps={showFps}
              toggleFps={toggleFps}
              audioFix={audioFix}
              toggleAudioFix={toggleAudioFix}
              showMangohud={showMangohud}
              toggleMangoHud={toggleMangoHud}
              isDefault={isDefault}
            />
          )}
          {isSyncSettings && (
            <SyncSaves
              savesPath={savesPath}
              setSavesPath={setSavesPath}
              appName={appName}
              autoSyncSaves={autoSyncSaves}
              setAutoSyncSaves={setAutoSyncSaves}
              defaultFolder={winePrefix}
              isProton={wineVersion.name.includes('Proton')}
              winePrefix={winePrefix}
            />
          )}
          <span className="save">{t('info.settings')}</span>
        </div>
      </div>
    </>
  )
}
