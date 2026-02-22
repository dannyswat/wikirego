import { IconCheck, IconCrop11 } from "@tabler/icons-react";

interface ToggleButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
    checked: boolean;
    label: string;
    onChange: (value: boolean) => void;
}

export default function ToggleButton({ className, checked, onChange, label, ...props }: ToggleButtonProps) {

    return (
        <button className={'inline-flex items-center rounded-md px-1 py-1 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 ' + (className ? ' ' + className : '')} {...props}
            onClick={() => onChange(!checked)}>
            {checked && <IconCheck size={16} className="mr-2 inline-block text-emerald-600 dark:text-emerald-400" />}
            {!checked && <IconCrop11 size={16} className="mr-2 inline-block text-slate-400 dark:text-slate-500" />}
            <label className="inline-block cursor-pointer">{label}</label>
        </button>
    );
}