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
        <div className="flex flex-col items-center">
            {value && (
                <img src={value} alt={t('Preview')} className="mb-4 max-w-full h-auto rounded" />
            )}
            {!value && <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="mb-2 w-full"
            />}
            {value && <button
                type="button"
                onClick={() => onChange('')}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
                {t('Clear Image')}
            </button>}
        </div>
    );

}