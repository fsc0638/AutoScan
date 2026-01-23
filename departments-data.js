/**
 * Department Data Structure
 * Based on Kway Portal Department List
 * Extracted: 2026-01-22
 */

const DEPARTMENTS = {
    "研發組": [
        {
            code: "Y000",
            name: "研發中心",
            fullName: "Y000　研發中心",
            subDepts: [
                { code: "Y200", name: "研發中心-開發處", fullName: "Y200　研發中心-開發處" }
            ]
        },
        {
            code: "T200",
            name: "(一)產品開發一處",
            fullName: "T200　(一)產品開發一處",
            parent: "T000　第一事業群",
            subDepts: [
                { code: "T201", name: "(一)產品開發一處開發一組", fullName: "T201　(一)產品開發一處開發一組" },
                { code: "T202", name: "(一)產品開發一處開發二組", fullName: "T202　(一)產品開發一處開發二組" },
                { code: "T203", name: "(一)產品開發一處開發三組", fullName: "T203　(一)產品開發一處開發三組" }
            ]
        },
        {
            code: "T250",
            name: "(二)產品開發處",
            fullName: "T250　(二)產品開發處",
            parent: "T100　第二事業群",
            subDepts: [
                { code: "T251", name: "(二)產品開發處專案組", fullName: "T251　(二)產品開發處專案組" },
                { code: "T252", name: "(二)產品開發處開發一組", fullName: "T252　(二)產品開發處開發一組" },
                { code: "T253", name: "(二)產品開發處開發三組", fullName: "T253　(二)產品開發處開發三組" },
                { code: "T254", name: "(二)產品開發處開發四組", fullName: "T254　(二)產品開發處開發四組" },
                { code: "T255", name: "(二)產品開發處開發二組", fullName: "T255　(二)產品開發處開發二組" }
            ]
        },
        {
            code: "T610",
            name: "(三)創新產品處",
            fullName: "T610　(三)創新產品處",
            parent: "T600　第三事業群",
            subDepts: [
                { code: "T611", name: "開發組", fullName: "T611　開發組" },
                { code: "T612", name: "產品一組", fullName: "T612　產品一組" },
                { code: "T613", name: "產品二組", fullName: "T613　產品二組" }
            ]
        },
        {
            code: "C130",
            name: "資訊處",
            fullName: "C130　資訊處",
            parent: "A200　董總辦公室",
            subDepts: []
        }
    ],

    "業務組": [
        {
            code: "T140",
            name: "(一)業務處",
            fullName: "T140　(一)業務處",
            parent: "T000　第一事業群",
            subDepts: []
        },
        {
            code: "T240",
            name: "(二)業務處",
            fullName: "T240　(二)業務處",
            parent: "T100　第二事業群",
            subDepts: [
                { code: "T242", name: "策略產品業務組", fullName: "T242　策略產品業務組" }
            ]
        }
    ],

    "行銷組": [
        {
            code: "C140",
            name: "公關暨專案室",
            fullName: "C140　公關暨專案室",
            parent: "A200　董總辦公室",
            subDepts: []
        }
    ],

    "管理組": [
        {
            code: "A000",
            name: "董事長室",
            fullName: "A000　董事長室",
            subDepts: []
        },
        {
            code: "B000",
            name: "總經理室",
            fullName: "B000　總經理室",
            subDepts: [
                { code: "B100", name: "(總)-交易所專案處", fullName: "B100　(總)-交易所專案處" }
            ]
        },
        {
            code: "C110",
            name: "管理處",
            fullName: "C110　管理處",
            parent: "A200　董總辦公室",
            subDepts: []
        },
        {
            code: "C120",
            name: "財務處",
            fullName: "C120　財務處",
            parent: "A200　董總辦公室",
            subDepts: []
        },
        {
            code: "T210",
            name: "(一)帳務產品處",
            fullName: "T210　(一)帳務產品處",
            parent: "T000　第一事業群",
            subDepts: [
                { code: "T211", name: "(一)帳務產品處-帳務一組", fullName: "T211　(一)帳務產品處-帳務一組" },
                { code: "T212", name: "(一)帳務產品處-帳務二組", fullName: "T212　(一)帳務產品處-帳務二組" }
            ]
        },
        {
            code: "T230",
            name: "(一)產品服務處",
            fullName: "T230　(一)產品服務處",
            parent: "T000　第一事業群",
            subDepts: [
                { code: "T231", name: "(一)產品服務處-服務一組", fullName: "T231　(一)產品服務處-服務一組" },
                { code: "T233", name: "(一)產品服務處-專案組", fullName: "T233　(一)產品服務處-專案組" }
            ]
        },
        {
            code: "T260",
            name: "(二)產品服務處",
            fullName: "T260　(二)產品服務處",
            parent: "T100　第二事業群",
            subDepts: [
                { code: "T261", name: "(二)產品服務處-客服組", fullName: "T261　(二)產品服務處-客服組" },
                { code: "T262", name: "(二)產品服務處-機房組", fullName: "T262　(二)產品服務處-機房組" }
            ]
        }
    ]
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DEPARTMENTS };
}
