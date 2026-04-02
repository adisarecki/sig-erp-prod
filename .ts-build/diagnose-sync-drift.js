"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var client_1 = require("@prisma/client");
var prisma = new client_1.PrismaClient();
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var tenants, _i, tenants_1, tenant, pgCount, invoices, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 8, 9, 11]);
                    console.log("📊 SYNC DRIFT DIAGNOSTIC\n");
                    return [4 /*yield*/, prisma.tenant.findMany()];
                case 1:
                    tenants = _a.sent();
                    console.log("Found ".concat(tenants.length, " tenants:\n"));
                    _i = 0, tenants_1 = tenants;
                    _a.label = 2;
                case 2:
                    if (!(_i < tenants_1.length)) return [3 /*break*/, 7];
                    tenant = tenants_1[_i];
                    return [4 /*yield*/, prisma.invoice.count({
                            where: { tenantId: tenant.id }
                        })];
                case 3:
                    pgCount = _a.sent();
                    console.log("\uD83C\uDFE2 Tenant: ".concat(tenant.name, " (ID: ").concat(tenant.id, ")"));
                    console.log("   PostgreSQL Invoice Count: ".concat(pgCount));
                    if (!(pgCount > 0)) return [3 /*break*/, 5];
                    return [4 /*yield*/, prisma.invoice.findMany({
                            where: { tenantId: tenant.id },
                            select: {
                                id: true,
                                invoiceNumber: true,
                                amountNet: true,
                                amountGross: true,
                                createdAt: true
                            },
                            take: 5 // Show first 5
                        })];
                case 4:
                    invoices = _a.sent();
                    console.log("   Recent invoices:");
                    invoices.forEach(function (inv) {
                        console.log("   - ".concat(inv.invoiceNumber, " (").concat(inv.id, "): ").concat(inv.amountNet, " PLN net"));
                    });
                    _a.label = 5;
                case 5:
                    console.log();
                    _a.label = 6;
                case 6:
                    _i++;
                    return [3 /*break*/, 2];
                case 7:
                    console.log("\n✅ NOTE: This shows PostgreSQL data only.");
                    console.log("   To see Firestore data and sync status, call:");
                    console.log("   GET /api/maintenance/sync-drift?tenantId=<TENANT_ID>");
                    console.log("   Or visit: https://your-domain/dashboard and check the sync indicator");
                    return [3 /*break*/, 11];
                case 8:
                    error_1 = _a.sent();
                    console.error("❌ Error:", error_1);
                    process.exit(1);
                    return [3 /*break*/, 11];
                case 9: return [4 /*yield*/, prisma.$disconnect()];
                case 10:
                    _a.sent();
                    return [7 /*endfinally*/];
                case 11: return [2 /*return*/];
            }
        });
    });
}
main();
