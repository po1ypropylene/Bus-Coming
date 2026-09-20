import { Check, Palette } from 'lucide-react'
import { useApp } from '../../app/AppContext'
import { THEMES } from '../../types/transit'

export function ThemePicker() {
    const { user, updateUser, t } = useApp()
    return (
        <fieldset className="theme-picker">
            <legend>
                <Palette size={20} /> {t.theme}
            </legend>
            <div className="theme-options">
                {THEMES.map((theme) => (
                    <label className="theme-option" key={theme}>
                        <input
                            type="radio"
                            name="theme"
                            value={theme}
                            checked={user.theme === theme}
                            onChange={() => updateUser({ ...user, theme })}
                        />
                        <span className="theme-swatch" data-theme={theme}>
                            {user.theme === theme && <Check size={20} aria-hidden="true" />}
                        </span>
                        <span>{t.themeNames[theme]}</span>
                    </label>
                ))}
            </div>
        </fieldset>
    )
}
