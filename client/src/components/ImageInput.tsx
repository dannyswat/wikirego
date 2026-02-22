import { ChangeEvent } from "react";
import { uploadImage } from "../features/editors/uploadApi";
import { useTranslation } from "react-i18next";

interface ImageInputProps {
    value: string;
    onChange: (value: string) => void;
}

export default function ImageInput({ value, onChange }: ImageInputProps) {
    const { t } = useTranslation();
    const handleImageChange = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const { imageUrl } = await uploadImage(file, crypto.randomUUID());
            onChange(imageUrl);
        }
    };

    return (
        <div className="flex flex-col items-start gap-2">
            {value && (
                <img src={value} alt={t('Preview')} className="max-h-40 w-auto max-w-full rounded-lg border border-slate-200 object-contain dark:border-slate-700" />
            )}
            {!value && <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="w-full cursor-pointer rounded-lg border border-slate-300 bg-white p-2.5 text-sm text-slate-900 outline-none transition file:mr-3 file:rounded-md file:border-0 file:bg-[#2d6880] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-[#1e5770] focus:border-[#2d6880] focus:ring-2 focus:ring-[#92A7B4]/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />}
            {value && <button
                type="button"
                onClick={() => onChange('')}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
            >
                {t('Clear Image')}
            </button>}
        </div>
    );

}