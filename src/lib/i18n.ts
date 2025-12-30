import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Translation resources
const resources = {
    en: {
        translation: {
            settings: {
                title: "Settings",
                description: "Manage your account and application preferences",
                profile: "Profile",
                preferences: "Preferences",
                save: "Save Changes",
                saving: "Saving...",
                logout: "Log Out",
                language: "Language",
                languageDesc: "Select your preferred language",
                success: "Profile updated successfully",
                error: "Failed to update profile",
                fullName: "Full Name",
                phoneNumber: "Phone Number",
                location: "Location",
                loading: "Loading profile...",
                selectRegion: "Select your region"
            },
            nav: {
                dashboard: "Dashboard",
                scan: "Scan",
                farms: "Farms",
                trees: "Trees",
                planning: "Planning",
                settings: "Settings"
            }
        }
    },
    sw: {
        translation: {
            settings: {
                title: "Mipangilio",
                description: "Dhibiti akaunti yako na mapendeleo ya programu",
                profile: "Wasifu",
                preferences: "Mapendeleo",
                save: "Hifadhi Mabadiliko",
                saving: "inahifadhi...",
                logout: "Ondoka",
                language: "Lugha",
                languageDesc: "Chagua lugha unayopendelea",
                success: "Wasifu umesasishwa kikamilifu",
                error: "Imeshindwa kusasisha wasifu",
                fullName: "Jina Kamili",
                phoneNumber: "Nambari ya Simu",
                location: "Eneo",
                loading: "Inapakia wasifu...",
                selectRegion: "Chagua eneo lako"
            },
            nav: {
                dashboard: "Dashibodi",
                scan: "Changanua",
                farms: "Mashamba",
                trees: "Miti",
                planning: "Mipango",
                settings: "Mipangilio"
            }
        }
    }
};

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources,
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false // react already safes from xss
        }
    });

export default i18n;
