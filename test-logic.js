// Manual verification of Hardened Vector 116 algorithms (NIP & Normalization)

function isValidNip(nip) {
    const digits = nip.replace(/\D/g, "");
    if (digits.length !== 10) return false;
    
    const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
    let sum = 0;
    for (let i = 0; i < 9; i++) {
        sum += parseInt(digits[i]) * weights[i];
    }
    return (sum % 11) === parseInt(digits[9]);
}

function hardenNormalizeName(name) {
    if (!name) return "";
    
    // 1. Case-folding + Diacritic normalization (simplified for node test)
    let n = name.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/ł/g, "l").replace(/ą/g, "a").replace(/ć/g, "c").replace(/ę/g, "e")
        .replace(/ń/g, "n").replace(/ó/g, "o").replace(/ś/g, "s").replace(/ź/g, "z").replace(/ż/g, "z");

    // 2. Suffixes
    const suffixes = [
        "sp. z o.o.", "s.a.", "sp. k.", "sp. j.", "s.c.", "sp. p.",
        "spolka akcyjna", "spolka z ograniczona odpowiedzialnoscia",
        "spolka komandytowa", "spolka jawna", "spolka cywilna"
    ];
    
    for (const s of suffixes) {
        n = n.replace(new RegExp(`\\b${s.replace(/\./g, "\\.")}\\b`, "ig"), "");
    }

    return n.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").replace(/\s{2,}/g, " ").trim().toUpperCase();
}

console.log("--- 🧪 ALGORITHM VERIFICATION ---");
console.log("1. NIP Checksum:");
console.log("   - 9542751368 (Valid):", isValidNip("9542751368") ? "✅" : "❌");
console.log("   - 1234567890 (Invalid):", !isValidNip("1234567890") ? "✅" : "❌");

console.log("2. Normalization:");
const testNames = [
    "ALIBABA SP. Z O.O.",
    "ALIBABA SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ",
    "ALIBABA S.A.",
    "ALIBABA Sp. k."
];
testNames.forEach(tn => {
    console.log(`   - "${tn}" -> "${hardenNormalizeName(tn)}"`);
});
