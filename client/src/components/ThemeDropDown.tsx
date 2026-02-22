import { useTranslation } from "react-i18next";

interface ThemeDropDownProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> {
    value: string;
    onChange: (theme: string) => void;
    className?: string;
}

export default function ThemeDropDown(
    { className, value, onChange }: ThemeDropDownProps) {
    const { t } = useTranslation();

    return (
        <select className={'rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-[#2d6880] focus:ring-2 focus:ring-[#92A7B4]/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100' + (className ? ' ' + className : '')}
            value={value} onChange={(e) => onChange(e.target.value)}>
            <option value="default">{t('Auto Theme')}</option>
            <option value="light">{t('Light')}</option>
            <option value="dark">{t('Dark')}</option>

        </select>);
}