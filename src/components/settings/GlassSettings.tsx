import { useApp } from '../../app/AppContext'
import { DEFAULT_GLASS, type GlassPreferences } from '../../utils/glass'

export function GlassSettings() {
    const { user, updateUser, t } = useApp()
    const glass = user.glass ?? DEFAULT_GLASS
    const change = (patch: Partial<GlassPreferences>) =>
        updateUser({ ...user, glass: { ...glass, ...patch } })
    return (
        <fieldset className="glass-settings">
            <legend>{t.glassEffects}</legend>
            <label htmlFor="glass-intensity">{t.glassIntensity}</label>
            <input
                id="glass-intensity"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={glass.intensity}
                onChange={(event) => change({ intensity: Number(event.target.value) })}
            />
            <div className="glass-range-labels">
                <span>{t.glassClear}</span>
                <span>{t.glassTinted}</span>
            </div>
            <label className="setting-row">
                {t.glassMode}
                <select
                    value={glass.mode}
                    onChange={(event) =>
                        change({ mode: event.target.value as GlassPreferences['mode'] })
                    }
                >
                    <option value="auto">{t.glassAuto}</option>
                    <option value="full">{t.glassFull}</option>
                    <option value="reduced">{t.glassReduced}</option>
                </select>
            </label>
            <label className="setting-row">
                {t.glassRefraction}
                <input
                    type="checkbox"
                    role="switch"
                    checked={glass.refraction}
                    onChange={(event) => change({ refraction: event.target.checked })}
                />
            </label>
            <div className="glass-preview">
                <span className="glass">{t.glassPreview}</span>
            </div>
            <p className="glass-degraded" role="status">
                {t.glassDegraded}
            </p>
        </fieldset>
    )
}
