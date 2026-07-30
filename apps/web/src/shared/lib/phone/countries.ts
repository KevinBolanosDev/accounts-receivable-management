// Catálogo de indicativos telefónicos.
//
// Es una tabla estática y no una librería (`libphonenumber-js` pesa ~150 kB):
// lo único que necesita la app es elegir un indicativo y guardarlo pegado al
// número. La validación por país (longitudes, prefijos móviles) NO se hace —
// sería una promesa que esta tabla no puede cumplir para 200 países.
//
// `dial` va sin `+`. `iso2` es la clave estable (dos países comparten
// indicativo: +1 lo usan US, CA y todo el Caribe).

export interface Country {
  iso2: string;
  name: string;
  dial: string;
  flag: string;
}

// Ordenados por nombre dentro de cada bloque; el bloque de arriba son los que
// esta app usa a diario, para que no haya que buscarlos.
export const COUNTRIES: Country[] = [
  { iso2: "CO", name: "Colombia", dial: "57", flag: "🇨🇴" },
  { iso2: "AR", name: "Argentina", dial: "54", flag: "🇦🇷" },
  { iso2: "BO", name: "Bolivia", dial: "591", flag: "🇧🇴" },
  { iso2: "BR", name: "Brasil", dial: "55", flag: "🇧🇷" },
  { iso2: "CL", name: "Chile", dial: "56", flag: "🇨🇱" },
  { iso2: "CR", name: "Costa Rica", dial: "506", flag: "🇨🇷" },
  { iso2: "CU", name: "Cuba", dial: "53", flag: "🇨🇺" },
  { iso2: "EC", name: "Ecuador", dial: "593", flag: "🇪🇨" },
  { iso2: "SV", name: "El Salvador", dial: "503", flag: "🇸🇻" },
  { iso2: "ES", name: "España", dial: "34", flag: "🇪🇸" },
  { iso2: "US", name: "Estados Unidos", dial: "1", flag: "🇺🇸" },
  { iso2: "GT", name: "Guatemala", dial: "502", flag: "🇬🇹" },
  { iso2: "HN", name: "Honduras", dial: "504", flag: "🇭🇳" },
  { iso2: "MX", name: "México", dial: "52", flag: "🇲🇽" },
  { iso2: "NI", name: "Nicaragua", dial: "505", flag: "🇳🇮" },
  { iso2: "PA", name: "Panamá", dial: "507", flag: "🇵🇦" },
  { iso2: "PY", name: "Paraguay", dial: "595", flag: "🇵🇾" },
  { iso2: "PE", name: "Perú", dial: "51", flag: "🇵🇪" },
  { iso2: "PR", name: "Puerto Rico", dial: "1787", flag: "🇵🇷" },
  { iso2: "DO", name: "República Dominicana", dial: "1809", flag: "🇩🇴" },
  { iso2: "UY", name: "Uruguay", dial: "598", flag: "🇺🇾" },
  { iso2: "VE", name: "Venezuela", dial: "58", flag: "🇻🇪" },

  { iso2: "DE", name: "Alemania", dial: "49", flag: "🇩🇪" },
  { iso2: "AO", name: "Angola", dial: "244", flag: "🇦🇴" },
  { iso2: "SA", name: "Arabia Saudita", dial: "966", flag: "🇸🇦" },
  { iso2: "DZ", name: "Argelia", dial: "213", flag: "🇩🇿" },
  { iso2: "AU", name: "Australia", dial: "61", flag: "🇦🇺" },
  { iso2: "AT", name: "Austria", dial: "43", flag: "🇦🇹" },
  { iso2: "BE", name: "Bélgica", dial: "32", flag: "🇧🇪" },
  { iso2: "BY", name: "Bielorrusia", dial: "375", flag: "🇧🇾" },
  { iso2: "BG", name: "Bulgaria", dial: "359", flag: "🇧🇬" },
  { iso2: "CA", name: "Canadá", dial: "1", flag: "🇨🇦" },
  { iso2: "QA", name: "Catar", dial: "974", flag: "🇶🇦" },
  { iso2: "CZ", name: "Chequia", dial: "420", flag: "🇨🇿" },
  { iso2: "CN", name: "China", dial: "86", flag: "🇨🇳" },
  { iso2: "CY", name: "Chipre", dial: "357", flag: "🇨🇾" },
  { iso2: "KR", name: "Corea del Sur", dial: "82", flag: "🇰🇷" },
  { iso2: "CI", name: "Costa de Marfil", dial: "225", flag: "🇨🇮" },
  { iso2: "HR", name: "Croacia", dial: "385", flag: "🇭🇷" },
  { iso2: "DK", name: "Dinamarca", dial: "45", flag: "🇩🇰" },
  { iso2: "EG", name: "Egipto", dial: "20", flag: "🇪🇬" },
  { iso2: "AE", name: "Emiratos Árabes Unidos", dial: "971", flag: "🇦🇪" },
  { iso2: "SK", name: "Eslovaquia", dial: "421", flag: "🇸🇰" },
  { iso2: "SI", name: "Eslovenia", dial: "386", flag: "🇸🇮" },
  { iso2: "EE", name: "Estonia", dial: "372", flag: "🇪🇪" },
  { iso2: "ET", name: "Etiopía", dial: "251", flag: "🇪🇹" },
  { iso2: "PH", name: "Filipinas", dial: "63", flag: "🇵🇭" },
  { iso2: "FI", name: "Finlandia", dial: "358", flag: "🇫🇮" },
  { iso2: "FR", name: "Francia", dial: "33", flag: "🇫🇷" },
  { iso2: "GH", name: "Ghana", dial: "233", flag: "🇬🇭" },
  { iso2: "GR", name: "Grecia", dial: "30", flag: "🇬🇷" },
  { iso2: "HT", name: "Haití", dial: "509", flag: "🇭🇹" },
  { iso2: "HU", name: "Hungría", dial: "36", flag: "🇭🇺" },
  { iso2: "IN", name: "India", dial: "91", flag: "🇮🇳" },
  { iso2: "ID", name: "Indonesia", dial: "62", flag: "🇮🇩" },
  { iso2: "IQ", name: "Irak", dial: "964", flag: "🇮🇶" },
  { iso2: "IE", name: "Irlanda", dial: "353", flag: "🇮🇪" },
  { iso2: "IL", name: "Israel", dial: "972", flag: "🇮🇱" },
  { iso2: "IT", name: "Italia", dial: "39", flag: "🇮🇹" },
  { iso2: "JM", name: "Jamaica", dial: "1876", flag: "🇯🇲" },
  { iso2: "JP", name: "Japón", dial: "81", flag: "🇯🇵" },
  { iso2: "JO", name: "Jordania", dial: "962", flag: "🇯🇴" },
  { iso2: "KZ", name: "Kazajistán", dial: "7", flag: "🇰🇿" },
  { iso2: "KE", name: "Kenia", dial: "254", flag: "🇰🇪" },
  { iso2: "LV", name: "Letonia", dial: "371", flag: "🇱🇻" },
  { iso2: "LB", name: "Líbano", dial: "961", flag: "🇱🇧" },
  { iso2: "LT", name: "Lituania", dial: "370", flag: "🇱🇹" },
  { iso2: "LU", name: "Luxemburgo", dial: "352", flag: "🇱🇺" },
  { iso2: "MY", name: "Malasia", dial: "60", flag: "🇲🇾" },
  { iso2: "MA", name: "Marruecos", dial: "212", flag: "🇲🇦" },
  { iso2: "NG", name: "Nigeria", dial: "234", flag: "🇳🇬" },
  { iso2: "NO", name: "Noruega", dial: "47", flag: "🇳🇴" },
  { iso2: "NZ", name: "Nueva Zelanda", dial: "64", flag: "🇳🇿" },
  { iso2: "NL", name: "Países Bajos", dial: "31", flag: "🇳🇱" },
  { iso2: "PK", name: "Pakistán", dial: "92", flag: "🇵🇰" },
  { iso2: "PL", name: "Polonia", dial: "48", flag: "🇵🇱" },
  { iso2: "PT", name: "Portugal", dial: "351", flag: "🇵🇹" },
  { iso2: "GB", name: "Reino Unido", dial: "44", flag: "🇬🇧" },
  { iso2: "RO", name: "Rumanía", dial: "40", flag: "🇷🇴" },
  { iso2: "RU", name: "Rusia", dial: "7", flag: "🇷🇺" },
  { iso2: "SN", name: "Senegal", dial: "221", flag: "🇸🇳" },
  { iso2: "RS", name: "Serbia", dial: "381", flag: "🇷🇸" },
  { iso2: "SG", name: "Singapur", dial: "65", flag: "🇸🇬" },
  { iso2: "ZA", name: "Sudáfrica", dial: "27", flag: "🇿🇦" },
  { iso2: "SE", name: "Suecia", dial: "46", flag: "🇸🇪" },
  { iso2: "CH", name: "Suiza", dial: "41", flag: "🇨🇭" },
  { iso2: "TH", name: "Tailandia", dial: "66", flag: "🇹🇭" },
  { iso2: "TW", name: "Taiwán", dial: "886", flag: "🇹🇼" },
  { iso2: "TZ", name: "Tanzania", dial: "255", flag: "🇹🇿" },
  { iso2: "TN", name: "Túnez", dial: "216", flag: "🇹🇳" },
  { iso2: "TR", name: "Turquía", dial: "90", flag: "🇹🇷" },
  { iso2: "UA", name: "Ucrania", dial: "380", flag: "🇺🇦" },
  { iso2: "VN", name: "Vietnam", dial: "84", flag: "🇻🇳" },
];

/**
 * País por defecto de los números nuevos y de los legados (los guardados antes
 * de que existiera el selector, que no tienen `+`). El sistema nació operando
 * en Colombia: toda la UI formatea en COP y en `America/Bogota`.
 */
export const DEFAULT_COUNTRY: Country =
  COUNTRIES.find((c) => c.iso2 === "CO") ?? (COUNTRIES[0] as Country);

/**
 * País de un indicativo. Con indicativos compartidos (+1, +7) devuelve el
 * primero de la tabla — para el formato de salida da igual, y el usuario
 * puede elegir el que quiera en el selector.
 */
export function findCountryByDial(dial: string): Country | undefined {
  return COUNTRIES.find((c) => c.dial === dial);
}
