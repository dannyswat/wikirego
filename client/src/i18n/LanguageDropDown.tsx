interface LanguageDropDownProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> {
    value: string;
    onChange: (lang: string) => void;
    className?: string;
}

export default function LanguageDropDown(
    { className, value, onChange }: LanguageDropDownProps) {
    return (
        <select className={'rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-[#2d6880] focus:ring-2 focus:ring-[#92A7B4]/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100' + (className ? ' ' + className : '')}
            value={value} onChange={(e) => onChange(e.target.value)}>
            <option value="en">English</option>
            <option value="cn">简体中文</option>
            <option value="zh">繁體中文</option>
            <option value="fr">Français</option>
            <option value="jp">日本語</option>
        </select>);
}