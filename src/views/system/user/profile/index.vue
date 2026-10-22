<template>
  <div class="profile-container">
    <!-- 顶部用户横幅 -->
    <div class="profile-banner">
      <div class="banner-bg">
        <!-- 简化的动态圆圈背景动画 -->
        <div class="floating-circles">
          <div class="circle circle-1"></div>
          <div class="circle circle-2"></div>
          <div class="circle circle-3"></div>
          <div class="circle circle-4"></div>
          <div class="circle circle-5"></div>
          <div class="circle circle-6"></div>
          <div class="circle circle-7"></div>
          <div class="circle circle-8"></div>
          <div class="circle circle-9"></div>
          <div class="circle circle-10"></div>
          <div class="circle circle-11"></div>
          <div class="circle circle-12"></div>
          <div class="circle circle-13"></div>
          <div class="circle circle-14"></div>
          <div class="circle circle-15"></div>
        </div>
      </div>
      <div class="banner-content">
        <div class="user-header">
          <div class="avatar-section">
            <userAvatar :user="user" />
          </div>
          <div class="user-basic-info">
            <h1 class="user-name">{{ user.nickName }}</h1>
            <div class="user-tags">
              <el-tag type="primary" effect="plain" size="small">
                <svg-icon icon-class="peoples" style="margin-right: 4px" />
                {{ roleGroup }}
              </el-tag>
              <el-tag type="success" effect="plain" size="small" v-if="user.dept">
                <svg-icon icon-class="tree" style="margin-right: 4px" />
                {{ user.dept.deptName }}
              </el-tag>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 信息卡片区域 -->
    <div class="profile-content">
      <!-- 详细信息卡片 -->
      <el-row :gutter="20">
        <el-col :span="12" :xs="24">
          <el-card class="info-card" shadow="hover">
            <template #header>
              <div class="card-title">
                <svg-icon icon-class="user" class="title-icon" />
                <span>基本信息</span>
              </div>
            </template>
            <div class="info-grid">
              <div class="info-item">
                <div class="label">用户名称</div>
                <div class="value">{{ user.userName }}</div>
              </div>
              <div class="info-item">
                <div class="label">用户昵称</div>
                <div class="value">{{ user.nickName }}</div>
              </div>
              <div class="info-item">
                <div class="label">手机号码</div>
                <div class="value">{{ user.phonenumber || '-' }}</div>
              </div>
              <div class="info-item">
                <div class="label">用户邮箱</div>
                <div class="value">{{ user.email || '-' }}</div>
              </div>
            </div>
          </el-card>
        </el-col>

        <el-col :span="12" :xs="24">
          <el-card class="info-card" shadow="hover">
            <template #header>
              <div class="card-title">
                <svg-icon icon-class="tree" class="title-icon" />
                <span>组织信息</span>
              </div>
            </template>
            <div class="info-grid">
              <div class="info-item">
                <div class="label">所属部门</div>
                <div class="value">{{ user.dept ? user.dept.deptName : '-' }}</div>
              </div>
              <div class="info-item">
                <div class="label">所属岗位</div>
                <div class="value">{{ postGroup || '-' }}</div>
              </div>
              <div class="info-item">
                <div class="label">所属角色</div>
                <div class="value">{{ roleGroup || '-' }}</div>
              </div>
              <div class="info-item">
                <div class="label">创建时间</div>
                <div class="value">{{ parseTime(user.createTime) }}</div>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <!-- 操作卡片 -->
      <el-row :gutter="20" style="margin-top: 20px">
        <el-col :span="24">
          <el-card class="operation-card" shadow="hover">
            <el-tabs v-model="activeTab" class="profile-tabs">
              <el-tab-pane name="userinfo">
                <template #label>
                  <span class="tab-label">
                    <i class="el-icon-edit"></i>
                    基本资料
                  </span>
                </template>
                <userInfo :user="user" />
              </el-tab-pane>
              <el-tab-pane name="resetPwd">
                <template #label>
                  <span class="tab-label">
                    <i class="el-icon-lock"></i>
                    修改密码
                  </span>
                </template>
                <resetPwd :user="user" />
              </el-tab-pane>
            </el-tabs>
          </el-card>
        </el-col>
      </el-row>
    </div>
  </div>
</template>

<script>
import userAvatar from "./userAvatar";
import userInfo from "./userInfo";
import resetPwd from "./resetPwd";
import { getUserProfile } from "@/api/system/user";

export default {
  name: "Profile",
  components: { userAvatar, userInfo, resetPwd },
  data() {
    return {
      user: {},
      roleGroup: {},
      postGroup: {},
      activeTab: "userinfo"
    };
  },
  created() {
    this.getUser();
  },
  methods: {
    getUser() {
      getUserProfile().then(response => {
        this.user = response.data;
        this.roleGroup = response.roleGroup;
        this.postGroup = response.postGroup;
      });
    }
  }
};
</script>

<style lang="scss" scoped>
.profile-container {
  background: #f0f2f5;
  min-height: calc(100vh - 54px);
  padding-bottom: 30px;
}

// 顶部横幅
.profile-banner {
  position: relative;
  height: 280px;
  overflow: visible;
  margin-bottom: -60px;

  .banner-bg {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 100%;
    overflow: hidden;
    background: linear-gradient(-45deg, #2E74FF, #DA62E1, #FF64AC, #FF8F78, #FFC65C, #F9F871);
    background-size: 400% 400%;
    animation: gradientShift 15s ease infinite;
  }

  @keyframes gradientShift {
    0% {
      background-position: 0% 50%;
    }
    50% {
      background-position: 100% 50%;
    }
    100% {
      background-position: 0% 50%;
    }
  }

  @keyframes float {
    0%, 100% {
      transform: translate(0, 0) scale(1);
    }
    33% {
      transform: translate(30px, -30px) scale(1.1);
    }
    66% {
      transform: translate(-20px, 20px) scale(0.9);
    }
  }

  @keyframes wave {
    0% {
      transform: translateX(0);
    }
    100% {
      transform: translateX(-50%);
    }
  }

  .banner-content {
    position: relative;
    z-index: 1;
    max-width: 1200px;
    margin: 0 auto;
    padding: 50px 20px 20px;
  }

  .user-header {
    display: flex;
    align-items: center;
    gap: 30px;

    .avatar-section {
      flex-shrink: 0;
      
      ::v-deep .user-info-head {
        border: 5px solid rgba(255, 255, 255, 0.4);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2), 0 0 0 2px rgba(255, 255, 255, 0.2);
        border-radius: 50%;
        transition: all 0.3s ease;
        
        &:hover {
          transform: scale(1.05);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3), 0 0 0 3px rgba(255, 255, 255, 0.3);
        }
      }
    }

    .user-basic-info {
      flex: 1;
      color: #fff;

      .user-name {
        margin: 0 0 15px 0;
        font-size: 32px;
        font-weight: bold;
        text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      }

      .user-tags {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;

        ::v-deep .el-tag {
          background: rgba(255, 255, 255, 0.25);
          border: 1px solid rgba(255, 255, 255, 0.4);
          color: #fff;
          backdrop-filter: blur(10px);
          padding: 8px 16px;
          font-size: 14px;
          transition: all 0.3s ease;
          
          &:hover {
            background: rgba(255, 255, 255, 0.35);
            transform: translateY(-2px);
          }
        }
      }
    }
  }
}

// 内容区域
.profile-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

// 信息卡片
.info-card {
  border-radius: 12px;
  border: none;
  transition: all 0.3s ease;
  margin-bottom: 20px;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
  }

  ::v-deep .el-card__header {
    background: linear-gradient(135deg, rgba(65, 88, 208, 0.08) 0%, rgba(200, 80, 192, 0.08) 100%);
    border-bottom: none;
    padding: 20px;
  }

  ::v-deep .el-card__body {
    padding: 25px;
  }

  .card-title {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 16px;
    font-weight: 600;
    color: #303133;

    .title-icon {
      color: #4158D0;
      font-size: 18px;
    }
  }

  .info-grid {
    display: grid;
    gap: 20px;

    .info-item {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-bottom: 15px;
      border-bottom: 1px solid #f0f0f0;

      &:last-child {
        border-bottom: none;
        padding-bottom: 0;
      }

      .label {
        font-size: 13px;
        color: #909399;
        font-weight: 500;
      }

      .value {
        font-size: 15px;
        color: #303133;
        font-weight: 600;
      }
    }
  }
}

// 操作卡片
.operation-card {
  border-radius: 12px;
  border: none;

  ::v-deep .el-card__body {
    padding: 30px;
  }

  .profile-tabs {
    .tab-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 15px;

      i {
        font-size: 16px;
      }
    }

    ::v-deep .el-tabs__header {
      margin-bottom: 30px;
    }

    ::v-deep .el-tabs__item {
      font-size: 15px;
      font-weight: 500;
      height: 50px;
      line-height: 50px;
      transition: all 0.3s ease;

      &:hover {
        color: #4158D0;
      }

      &.is-active {
        color: #4158D0;
        font-weight: 600;
      }
    }

    ::v-deep .el-tabs__active-bar {
      background: linear-gradient(90deg, #4158D0 0%, #C850C0 100%);
      height: 3px;
    }
  }
}

// 响应式设计
@media (max-width: 768px) {
  .profile-banner {
    height: auto;
    min-height: 240px;
    margin-bottom: 0;

    .banner-content {
      padding: 30px 20px;
    }

    .user-header {
      flex-direction: column;
      text-align: center;
      gap: 20px;

      .avatar-section {
        ::v-deep .user-info-head {
          width: 100px;
          height: 100px;
          
          img {
            width: 100px;
            height: 100px;
          }
        }
        
        ::v-deep .user-info-head:hover:after {
          line-height: 100px;
          font-size: 32px;
        }
      }

      .user-basic-info {
        .user-name {
          font-size: 24px;
        }

        .user-tags {
          justify-content: center;
        }
      }
    }
  }

  .profile-content {
    padding: 20px 10px;
  }

  .info-card {
    margin-bottom: 15px;

    ::v-deep .el-card__body {
      padding: 20px;
    }
  }

  .operation-card {
    ::v-deep .el-card__body {
      padding: 20px;
    }
  }
}

// 简化的浮动圆圈动画
.floating-circles {
  position: absolute;
  top:0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  z-index: 1;
}

.circle {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  border: 3px solid rgba(255, 255, 255, 0.4);
  box-shadow: 0 0 20px rgba(255, 255, 255, 0.2);
  animation: float 6s ease-in-out infinite;
}

.circle-1 {
  width: 60px;
  height: 60px;
  top: 15%;
  left: 10%;
  animation-delay: 0s;
  animation-duration: 8s;
}

.circle-2 {
  width: 45px;
  height: 45px;
  top: 60%;
  left: 85%;
  animation-delay: 1s;
  animation-duration: 6s;
}

.circle-3 {
  width: 80px;
  height: 80px;
  top: 5%;
  left: 75%;
  animation-delay: 2s;
  animation-duration: 10s;
}

.circle-4 {
  width: 35px;
  height: 35px;
  top: 75%;
  left: 20%;
  animation-delay: 3s;
  animation-duration: 7s;
}

.circle-5 {
  width: 90px;
  height: 90px;
  top: 35%;
  left: 50%;
  animation-delay: 4s;
  animation-duration: 12s;
}

.circle-6 {
  width: 50px;
  height: 50px;
  top: 10%;
  left: 40%;
  animation-delay: 5s;
  animation-duration: 9s;
}

.circle-7 {
  width: 65px;
  height: 65px;
  top: 80%;
  left: 65%;
  animation-delay: 6s;
  animation-duration: 8s;
}

.circle-8 {
  width: 70px;
  height: 70px;
  top: 25%;
  left: 15%;
  animation-delay: 7s;
  animation-duration: 11s;
}

.circle-9 {
  width: 40px;
  height: 40px;
  top: 45%;
  left: 25%;
  animation-delay: 8s;
  animation-duration: 9s;
}

.circle-10 {
  width: 55px;
  height: 55px;
  top: 20%;
  left: 60%;
  animation-delay: 9s;
  animation-duration: 7s;
}

.circle-11 {
  width: 75px;
  height: 75px;
  top: 65%;
  left: 45%;
  animation-delay: 10s;
  animation-duration: 10s;
}

.circle-12 {
  width: 30px;
  height: 30px;
  top: 85%;
  left: 80%;
  animation-delay: 11s;
  animation-duration: 6s;
}

.circle-13 {
  width: 85px;
  height: 85px;
  top: 50%;
  left: 75%;
  animation-delay: 12s;
  animation-duration: 8s;
}

.circle-14 {
  width: 42px;
  height: 42px;
  top: 30%;
  left: 80%;
  animation-delay: 13s;
  animation-duration: 11s;
}

.circle-15 {
  width: 58px;
  height: 58px;
  top: 70%;
  left: 35%;
  animation-delay: 14s;
  animation-duration: 9s;
}

@keyframes float {
  0%, 100% {
    transform: translateY(0px) translateX(0px) scale(1);
    opacity: 0.3;
  }
  25% {
    transform: translateY(-20px) translateX(10px) scale(1.1);
    opacity: 0.6;
  }
  50% {
    transform: translateY(-40px) translateX(-10px) scale(0.9);
    opacity: 0.8;
  }
  75% {
    transform: translateY(-20px) translateX(15px) scale(1.05);
    opacity: 0.5;
  }
}
</style>
